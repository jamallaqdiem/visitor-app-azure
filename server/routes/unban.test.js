const request = require("supertest");
const express = require("express");
const createUnbanVisitorRouter = require("./unban"); 

// Mock dependencies
const sql = { Int: 'Int' }; 
const TEST_MASTER_PASSWORD = "super-secret-password-123";

// Mock the dotenv dependency to inject a master password
jest.mock('dotenv/config', () => ({})); // Mock module to avoid loading actual .env
process.env.MASTER_PASSWORD = TEST_MASTER_PASSWORD;

//  storing the original console functions here
let originalConsoleLog;
let originalConsoleError;

let mockDbService; 
let app;

// Setup the mock Express application before each test
beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    // Reset the mock before each test
    mockDbService = {
        executeQuery: jest.fn(),
    };

    // Create the mock Express app
    app = express();
    //  body parser to read req.body.password
    app.use(express.json()); 

    // Attach the router. We pass the mocked 'sql' object .
    const unbanRouter = createUnbanVisitorRouter(mockDbService, sql); 
    app.use("/", unbanRouter); 
});

// Restore console functions after each test
afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
});

// Clean up environment variables after all tests
afterAll(() => {
    delete process.env.MASTER_PASSWORD;
});

describe('POST /unban-visitor/:id', () => {
    const API_ENDPOINT = '/unban-visitor';
    const VALID_ID = 42;
    const VALID_BODY = { password: TEST_MASTER_PASSWORD };

    // --- 403 Authorization Test ---
    test('should return 403 if the password is incorrect', async () => {
        const response = await request(app)
            .post(`${API_ENDPOINT}/${VALID_ID}`)
            .send({ password: "wrong-password" }); 
        
        expect(response.status).toBe(403); 
        expect(response.body).toHaveProperty('message', "Incorrect password.");
        expect(mockDbService.executeQuery).not.toHaveBeenCalled();
    });

    // --- 400 Validation Test ---
    test('should return 400 if the visitor ID is missing or invalid', async () => {
        // Test with non-numeric ID
        const response = await request(app)
            .post(`${API_ENDPOINT}/abc`)
            .send(VALID_BODY);
        
        expect(response.status).toBe(400); 
        expect(response.body).toHaveProperty('message', "Invalid Visitor ID.");
        expect(mockDbService.executeQuery).not.toHaveBeenCalled();
    });
    
    // --- 404 Not Found Test ---
    test('should return 404 if visitor ID exists but no rows were affected (i.e., visitor not found in DB)', async () => {
        // Mock executeQuery to return 0 rows affected
        mockDbService.executeQuery.mockResolvedValue({ rowsAffected: [0] });

        const response = await request(app)
            .post(`${API_ENDPOINT}/${VALID_ID}`)
            .send(VALID_BODY);
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message', "Visitor not found.");
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
    });
    
    // --- 500 Database Error Test ---
    test('should return 500 on a database error', async () => {
        const errorMessage = "Database Connection Lost";
        mockDbService.executeQuery.mockRejectedValue(new Error(errorMessage));
        
        const response = await request(app)
            .post(`${API_ENDPOINT}/${VALID_ID}`)
            .send(VALID_BODY);

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', `Database error: ${errorMessage}`);
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalled();
    });

    // --- 200 Success Test ---
    test('should return 200 and successfully unban the visitor', async () => {
        // Mock executeQuery to return 1 row affected for success
        mockDbService.executeQuery.mockResolvedValue({ rowsAffected: [1] });

        const response = await request(app)
            .post(`${API_ENDPOINT}/${VALID_ID}`)
            .send(VALID_BODY);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', `Visitor has been unbanned successfully.`);
        
        // Check if the database was queried correctly
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);

        const sqlQuery = mockDbService.executeQuery.mock.calls[0][0];
        const inputs = mockDbService.executeQuery.mock.calls[0][1];
        
        // Check SQL query content
        expect(sqlQuery).toContain('UPDATE visitors SET is_banned = 0 WHERE id = @visitorId');

        // Check SQL inputs
        expect(inputs).toHaveLength(1);
        expect(inputs[0].name).toBe('visitorId');
        expect(inputs[0].value).toBe(VALID_ID);
    });
});
