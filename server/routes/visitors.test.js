const request = require("supertest");
const express = require("express");
const createVisitorsRouter = require("./visitors");

const API_ENDPOINT = '/visitors';
const TEST_HOST = 'testserver.com';
const TEST_PROTOCOL = 'http';

let mockDbService; 
let app;
let originalConsoleError;

// Mock data structure that the SQL query returns, including the JSON string for dependents
const MOCK_DB_DATA = [
    {
        id: 101,
        first_name: "Jane",
        last_name: "Doe",
        photo_path: "photos/jane.jpg",
        is_banned: false,
        entry_time: new Date().toISOString(),
        known_as: "Janie",
        reason_for_visit: "Food Parcel",
        additional_dependents: JSON.stringify([
            { full_name: "Kid One", age: 8 },
            { full_name: "Kid Two", age: 12 }
        ]),
        // Include other fields as null/undefined for simplicity
        exit_time: null, address: null, phone_number: null, unit: null, company_name: null, type: null, mandatory_acknowledgment_taken: null,
    },
    {
        id: 102,
        first_name: "John",
        last_name: "Smith",
        photo_path: null, // Test case for no photo
        is_banned: true, // Should still show banned visitors if they are signed in
        entry_time: new Date().toISOString(),
        known_as: "Johnny",
        reason_for_visit: "Shelter",
        additional_dependents: null, // Test case for no dependents
        exit_time: null, address: null, phone_number: null, unit: null, company_name: null, type: null, mandatory_acknowledgment_taken: null,
    },
];

beforeEach(() => {
    // Suppress console.error output for a clean test run
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Reset the mock before each test
    mockDbService = {
        executeQuery: jest.fn(),
    };

    // Create the mock Express app
    app = express();
    
    // Inject mock host/protocol properties needed for photo URL construction 
    app.use((req, res, next) => {
        req.protocol = TEST_PROTOCOL;
        req.get = (header) => {
            if (header === 'host') return TEST_HOST;
            return undefined;
        };
        next();
    });

    // Attach the router
    const visitorsRouter = createVisitorsRouter(mockDbService); 
    app.use("/", visitorsRouter); 
});

afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
});


describe('GET /visitors', () => {

    // --- Test 1: Successful fetch and data transformation ---
    test('should return 200 with correctly formatted active visitor results, including parsed dependents and full URLs', async () => {
        // Mock the database to return the active visitor data
        mockDbService.executeQuery.mockResolvedValue({ recordset: MOCK_DB_DATA });

        const response = await request(app).get(API_ENDPOINT);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);

        // Check the first visitor (with photo and dependents)
        const jane = response.body.find(v => v.id === 101);
        expect(jane.photo).toBe(`${TEST_PROTOCOL}://${TEST_HOST}/photos/jane.jpg`);
        expect(jane.dependents).toHaveLength(2);
        expect(jane.dependents[0].full_name).toBe("Kid One");
        expect(jane.photo_path).toBeUndefined(); // Check cleanup
        expect(jane.additional_dependents).toBeUndefined(); // Check cleanup

        // Check the second visitor (no photo, no dependents)
        const john = response.body.find(v => v.id === 102);
        expect(john.photo).toBeNull();
        expect(john.dependents).toHaveLength(0);

        // Verify that executeQuery was called once with a non-empty string
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
        expect(mockDbService.executeQuery.mock.calls[0][0]).toContain('SELECT');
        expect(mockDbService.executeQuery.mock.calls[0][0]).toContain('WHERE T2.exit_time IS NULL');
    });

    // --- Test 2: Empty results ---
    test('should return an empty array if no visitors are signed in', async () => {
        // Mock the database to return an empty recordset
        mockDbService.executeQuery.mockResolvedValue({ recordset: [] });

        const response = await request(app).get(API_ENDPOINT);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
    });

    // --- Test 3: Database error handling ---
    test('should return 500 on a database error', async () => {
        const errorMessage = "Azure connection timeout";
        mockDbService.executeQuery.mockRejectedValue(new Error(errorMessage));

        const response = await request(app).get(API_ENDPOINT);

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', "Failed to retrieve active visitor data.");
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
        
        // Assert that the router's error handler was called (but not logged to test output)
        expect(console.error).toHaveBeenCalled();
    });
});
