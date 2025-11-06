const request = require('supertest');
const express = require('express');
const sql = require("mssql");
const createBanVisitorRouter = require('./ban'); 

// Helper to create a test app instance
function setupTestApp(dbService) {
    const app = express();
    app.use(express.json()); 
    app.use('/', createBanVisitorRouter(dbService));
    return app;
}

describe('POST /ban-visitor/:id', () => {
    // Mock the dbService object required by the router
    let mockDbService;
     let consoleErrorSpy; 

    // A fake Express app to run the tests against
    let app;

    // Define mock visitor ID for tests
    const TEST_VISITOR_ID = 101;
    const NON_EXISTENT_ID = 999;
    
    // Mock the sql object's necessary type for the input definition
    const mockSql = { Int: sql.Int }; 

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Reset the mock implementation before each test
        mockDbService = {
            executeQuery: jest.fn(),
        };
        app = setupTestApp(mockDbService);
    });

      afterEach(() => {
        // 3. Restore the spy after each test
        consoleErrorSpy.mockRestore(); 
    });

    // --- Test 1: Successful Ban ---
    test('should return 200 and a success message when visitor is banned', async () => {
        // Setup the mock to simulate a successful database update 
        mockDbService.executeQuery.mockResolvedValue({
            rowsAffected: [1], 
        });

        const response = await request(app)
            .post(`/ban-visitor/${TEST_VISITOR_ID}`)
            .expect('Content-Type', /json/)
            .expect(200);

        // Verify the response body
        expect(response.body.message).toBe('Visitor has been banned & signed out.');

        // Verify that the executeQuery function was called once with the correct parameters
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
        expect(mockDbService.executeQuery.mock.calls[0][1]).toEqual([
             { name: "visitorId", type: mockSql.Int, value: `${TEST_VISITOR_ID}` }, 
        ]);
    });

    // --- Test 2: Visitor Not Found ---
    test('should return 404 when the visitor ID does not exist', async () => {
        // (visitor not found)
        mockDbService.executeQuery.mockResolvedValue({
            rowsAffected: [0], 
        });

        const response = await request(app)
            .post(`/ban-visitor/${NON_EXISTENT_ID}`)
            .expect('Content-Type', /json/)
            .expect(404);

        expect(response.body.message).toBe('Visitor not found.');
    });

    // --- Test 3: Missing Visitor ID (Bad Request) ---
    test('should return 400 if no visitor ID is provided', async () => {
        const response = await request(app)
            .post('/ban-visitor/null') // Sending a value that might resolve to falsy 
            .expect(400); // Expect a 404 because Express path parameter expects *something*
    });

    // --- Test 4: Database Error ---
    test('should return 500 on a database connection or query error', async () => {
        // Setup the mock to simulate a database failure
      const dbError = new Error("Connection timed out.");
        mockDbService.executeQuery.mockRejectedValue(dbError);

        const response = await request(app)
            .post(`/ban-visitor/${TEST_VISITOR_ID}`)
            .expect('Content-Type', /json/)
            .expect(500);

        expect(response.body.error).toBe('A database error occurred while trying to ban the visitor.');
    });

});