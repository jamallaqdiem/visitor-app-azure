const request = require("supertest");
const express = require("express");
const createSearchVisitorsRouter = require("./search_visitors"); 

// Mock the mssql types
const mockSql = {
    NVarChar: "NVarChar", 
    Int: "Int",
    Bit: "Bit"
};

// Helper function to set up the Express app for testing
function setupTestApp(dbService, sqlMock) {
    const app = express();
    app.use(express.json());
    // Mock protocol and host for photo URL construction
    app.use((req, res, next) => {
        // we use the http as supertest default
        req.protocol = 'http'; 
        req.get = jest.fn((header) => {
            if (header === 'host') return 'api.test.com';
            return null;
        });
        next();
    });
    // Pass both dbService and the mockSql object
    app.use("/", createSearchVisitorsRouter(dbService, sqlMock));
    return app;
}

describe("GET /visitor-search Endpoint", () => {
    let mockDbService;
    let app;
    let consoleErrorSpy;

    // --- MOCK DATA ---
    const mockDependentsJson = JSON.stringify([
        { full_name: "Junior Doe", age: 8 },
    ]);
    
    const mockVisitorRow = {
        id: 201,
        first_name: "Jane",
        last_name: "Doe",
        photo_path: "profiles/jane_doe.png",
        is_banned: 0, 
        known_as: "J.D.",
        address: "456 Oak St",
        phone_number: "555-4321",
        unit: "Apt 20",
        reason_for_visit: "Delivery",
        company_name: "Self",
        type: "Guest",
        mandatory_acknowledgment_taken: true,
        dependents_json: mockDependentsJson,
    };

    beforeEach(() => {
        // Suppress console logging for error handling tests
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Setup the mock dbService 
        mockDbService = {
            executeQuery: jest.fn(),
        };

        // Setup the app, passing the mock dbService and sql object
        app = setupTestApp(mockDbService, mockSql);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.restoreAllMocks();
    });

    // Validation Tests
    describe("Validation", () => {
        test("should return 400 if 'name' query parameter is missing", async () => {
            await request(app)
                .get("/visitor-search")
                .expect(400)
                .then(response => {
                    expect(response.body.message).toBe("Search term 'name' is required.");
                });
        });

        test("should return 400 if 'name' query parameter is empty/whitespace", async () => {
            await request(app)
                .get("/visitor-search?name=%20%20") // Encoded space
                .expect(400)
                .then(response => {
                    expect(response.body.message).toBe("Search term is required and cannot be empty.");
                });
        });
    });


    // Successful Query and Data Mapping Tests
    describe("Successful Query and Data Mapping", () => {
        // --- Test 1: Single Search Term and Data Mapping ---
        test("should query with a single term and correctly map output fields", async () => {
            const searchTerm = "jane";
            mockDbService.executeQuery.mockResolvedValue([mockVisitorRow]);

            const response = await request(app).get(`/visitor-search?name=${searchTerm}`).expect(200);

            // 1. Check SQL Parameters for single term
            const queryParams = mockDbService.executeQuery.mock.calls[0][1];
            expect(queryParams).toHaveLength(1);
            expect(queryParams[0]).toEqual({
                name: "term0",
                type: "NVarChar",
                value: `%${searchTerm}%`,
            });
            
            // 2. Check output data mapping
            expect(response.body).toHaveLength(1);
            const result = response.body[0];

            expect(result.photo).toBe("http://api.test.com/profiles/jane_doe.png");
            
            // is_banned passed through as number (0/1)
            expect(result.is_banned).toBe(0); 

            // Dependents JSON parsed correctly
            expect(result.dependents).toEqual(JSON.parse(mockDependentsJson));

            // Raw fields removed
            expect(result.photo_path).toBeUndefined();
            expect(result.dependents_json).toBeUndefined();
            expect(result.first_name).toBe("Jane"); // sanity check on main data
        });

        // --- Test 2: Multiple Search Terms (AND Logic) ---
        test("should query with multiple terms using AND logic and separate parameters", async () => {
            const searchTerm = "Jane Doe"; // Two terms: Jane and Doe
            mockDbService.executeQuery.mockResolvedValue([]); // No need for data here

            await request(app).get(`/visitor-search?name=${searchTerm}`).expect(200);

            // Check SQL Query
            const querySql = mockDbService.executeQuery.mock.calls[0][0];
            
            // Expect the WHERE clause to join two conditions with AND
            expect(querySql).toContain(
                "(T1.first_name LIKE @term0 OR T1.last_name LIKE @term0) AND (T1.first_name LIKE @term1 OR T1.last_name LIKE @term1)"
            );

            // Check SQL Parameters
            const queryParams = mockDbService.executeQuery.mock.calls[0][1];
            expect(queryParams).toHaveLength(2);
            expect(queryParams[0].name).toBe("term0");
            expect(queryParams[0].value).toBe("%Jane%");
            expect(queryParams[1].name).toBe("term1");
            expect(queryParams[1].value).toBe("%Doe%");
        });
    });


    // Error Handling Tests
    describe("Error Handling", () => {
        // --- Test 3: Database Error ---
        test("should return 500 on a database query error", async () => {
            const dbError = new Error("SQL connection failed.");
            // Setup mock to simulate failure
            mockDbService.executeQuery.mockRejectedValue(dbError);

            const response = await request(app).get("/visitor-search?name=test").expect(500);

            // Check response body
            expect(response.body.error).toBe(
                "Failed to search visitors due to a database error."
            );
            
            // Check that the error was logged internally
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Azure SQL Error in /visitor-search:",
                dbError.message
            );
        });

        // --- Test 4: Invalid JSON Dependent Data ---
        test("should handle invalid JSON dependent data gracefully and log an error", async () => {
            // Setup mock to return a row with malformed JSON
            const malformedRow = {
                ...mockVisitorRow,
                id: 202,
                dependents_json: '{"key": "value"', // Incomplete JSON
            };
            mockDbService.executeQuery.mockResolvedValue([malformedRow]);

            const response = await request(app).get("/visitor-search?name=malformed").expect(200);

            // The dependents array should be empty on failure
            expect(response.body[0].dependents).toEqual([]); 
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to parse dependents JSON:",
                expect.stringContaining("Expected ',' or '}'") 
            );
        });
    });
});
