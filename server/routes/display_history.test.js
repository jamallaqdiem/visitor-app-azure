const request = require("supertest");
const express = require("express");
const createHistoryRouter = require("./display_history");

// Mock environment variable and SQL module
const MOCK_MASTER_PASSWORD = "test-history-password";
process.env.MASTER_PASSWORD2 = MOCK_MASTER_PASSWORD;

jest.mock("mssql", () => ({
    NVarChar: "NVarChar",
    Int: "Int",
}));

// Mock the date to ensure deterministic end_date calculation for filtering tests
const MOCK_DATE = '2025-01-01';
const MOCK_END_OF_DAY = `${MOCK_DATE}T23:59:59.999Z`;

// Helper function to set up the Express app for testing
function setupTestApp(dbService) {
    const app = express();
    app.use(express.json());
    // Use a mock protocol/host for photo URL testing
    app.use((req, res, next) => {
        req.protocol = 'http';
        req.get = jest.fn((header) => {
            if (header === 'host') return 'localhost:3000';
            return null;
        });
        next();
    });
    app.use("/", createHistoryRouter(dbService));
    return app;
}

describe("History Router Endpoints", () => {
    let mockDbService;
    let app;
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        // Suppress console logging during tests
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Setup the mock dbService
        mockDbService = {
            executeQuery: jest.fn(),
        };

        app = setupTestApp(mockDbService);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        jest.restoreAllMocks(); 
    });

    // --- MOCK DATA ---
    const mockVisitRow = {
        visitor_id: 1,
        first_name: "John",
        last_name: "Doe",
        photo_path: "photos/123.jpg",
        is_banned: 0,
        visit_id: 100,
        entry_time: new Date().toISOString(),
        address: "123 Main St",
        additional_dependents_json: '[{"full_name":"Jane Doe","age":5}]',
    };

    // =================================================================
    // POST /authorize-history Tests
    // =================================================================

    describe("POST /authorize-history", () => {
        test("should return 200 for correct password", async () => {
            const response = await request(app)
                .post("/authorize-history")
                .send({ password: MOCK_MASTER_PASSWORD })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Authorization successful.");
        });

        test("should return 403 for incorrect password", async () => {
            const response = await request(app)
                .post("/authorize-history")
                .send({ password: "wrong-password" })
                .expect(403);

            expect(response.body.message).toBe("Incorrect password.");
        });
    });

    // GET /history Tests
   
    describe("GET /history", () => {
        // --- Test 1: No Filters, Success and Data Mapping ---
        test("should return 200 with all historical data and correctly map fields", async () => {
            // Setup mock to return one row
            mockDbService.executeQuery.mockResolvedValue([mockVisitRow]);

            const response = await request(app).get("/history").expect(200);

            const querySql = mockDbService.executeQuery.mock.calls[0][0];

            expect(mockDbService.executeQuery).toHaveBeenCalledWith(querySql, []);
            // Assert the response structure and data mapping
            expect(response.body).toHaveLength(1);
            const result = response.body[0];

            // 1. Photo URL 
            expect(result.photo).toBe("http://localhost:3000/photos/123.jpg");
            // 2. Dependents JSON 
            expect(result.dependents).toEqual([{ full_name: "Jane Doe", age: 5 }]);
            // 3. Raw fields removed from final output
            expect(result.photo_path).toBeUndefined();
            expect(result.additional_dependents_json).toBeUndefined();
        });
        
        // --- Test 2: Search Filter ---
        test("should query with a search filter on first_name/last_name", async () => {
            // Setup mock for success
            mockDbService.executeQuery.mockResolvedValue([]);

            const searchText = "john";
            await request(app).get(`/history?search=${searchText}`).expect(200);

            // Assert the query structure
            const querySql = mockDbService.executeQuery.mock.calls[0][0];
            const queryParams = mockDbService.executeQuery.mock.calls[0][1];

            expect(querySql).toContain(
                "(LOWER(T1.first_name) LIKE @searchParam OR LOWER(T1.last_name) LIKE @searchParam)"
            );
            expect(queryParams).toEqual([
                { name: "searchParam", type: "NVarChar", value: `%${searchText}%` },
            ]);
        });

        // --- Test 3: Date Range Filter ---
        test("should query with start_date and end_date filters", async () => {
            // Setup mock for success
            mockDbService.executeQuery.mockResolvedValue([]);

            await request(app)
                .get(`/history?start_date=${MOCK_DATE}&end_date=${MOCK_DATE}`)
                .expect(200);

            // Assert the query structure
            const querySql = mockDbService.executeQuery.mock.calls[0][0];
            const queryParams = mockDbService.executeQuery.mock.calls[0][1];

            expect(querySql).toContain("T2.entry_time >= @startDate AND T2.entry_time <= @endDate");
            expect(queryParams).toEqual([
                { name: "startDate", type: "NVarChar", value: MOCK_DATE },
                { name: "endDate", type: "NVarChar", value: MOCK_END_OF_DAY },
            ]);
        });
        
        // --- Test 4: Database Error ---
        test("should return 500 on a database query error", async () => {
            const dbError = new Error("Connection failed during GET.");
            // Setup mock to simulate failure
            mockDbService.executeQuery.mockRejectedValue(dbError);

            const response = await request(app).get("/history").expect(500);

            // Check response body
            expect(response.body.error).toBe(
                "Failed to retrieve historical data from the database."
            );
            
            // Check that the error was logged internally
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Azure SQL Error in GET /history:",
                dbError.message
            );
        });
        
        // --- Test 5: Invalid JSON Dependent Data ---
        test("should handle invalid JSON dependent data gracefully and log a warning", async () => {
            // Setup mock to return a row with malformed JSON
            const malformedRow = {
                ...mockVisitRow,
                additional_dependents_json: '{ "key": "value", }', // Invalid trailing comma
            };
            mockDbService.executeQuery.mockResolvedValue([malformedRow]);

            const response = await request(app).get("/history").expect(200);

            // The dependents array should be empty on failure, not the raw JSON string
            expect(response.body[0].dependents).toEqual([]); 
            // Warning should be logged
            expect(consoleWarnSpy).toHaveBeenCalled();
        });
    });
});
