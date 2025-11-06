const request = require('supertest');
const express = require('express');
const createLogoutRouter = require('./logout'); 

// --- Mocking Setup ---

const mockSqlTypes = {
    Int: 'Int',
    NVarChar: 'NVarChar',
};

// A mock for the executeQuery function 
const mockDbService = {
    executeQuery: jest.fn().mockResolvedValue([]), 
};

// Set a fixed mock time for predictable `exit_time`
const MOCK_TIMESTAMP = 1700000000000; 

function setupTestApp() {
    const app = express();
    app.use(express.json());
    // Pass the mock types to the router logic for the inputs array assertion
    const mockRouter = createLogoutRouter({
        ...mockDbService,
        sql: mockSqlTypes
    });
    app.use('/', mockRouter);
    return app;
}

// --- Mock Data ---
const TEST_ID = '101';
const ACTIVE_VISIT_ID = 999;
const MOCK_FIRST_NAME = 'Jamie';
const MOCK_LAST_NAME = 'Tester';
const MOCK_FULL_NAME = `${MOCK_FIRST_NAME} ${MOCK_LAST_NAME}`;

const mockActiveVisitRow = [{
    visit_id: ACTIVE_VISIT_ID,
    first_name: MOCK_FIRST_NAME,
    last_name: MOCK_LAST_NAME,
}];


describe('POST /exit-visitor/:id', () => {
    let app;
    let consoleErrorSpy;

    beforeAll(() => {
        jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP);
    });

    beforeEach(() => {
        // Clear mocks before each test
        mockDbService.executeQuery.mockClear();
        // Set up spy for console.error
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        app = setupTestApp();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore(); 
    });

    afterAll(() => {
        // Restore Date.now mock
        jest.spyOn(Date, 'now').mockRestore();
    });

    // --- Test 1: Successful Sign Out ---
    test('should return 200 and successfully update the exit time for an active visit', async () => {
        // 1. Mock the first call (SELECT): Returns an active visit row
        mockDbService.executeQuery.mockResolvedValueOnce(mockActiveVisitRow); 
        
        // 2. Mock the second call (UPDATE): Returns a successful result
        mockDbService.executeQuery.mockResolvedValueOnce({}); 

        const response = await request(app)
            .post(`/exit-visitor/${TEST_ID}`)
            .expect('Content-Type', /json/)
            .expect(200);

        // Assert response message
        expect(response.body.message).toBe(`${MOCK_FULL_NAME} has been successfully signed out.`);
        
        // Assert two DB calls were made
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(2);

        // Assert the arguments for the first call (Find Active Visit)
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(
            1, 
            expect.stringContaining('SELECT TOP 1'), 
            [{ name: "visitorId", type: expect.any(Function), value: TEST_ID }] 
        );

        // Assert the arguments for the second call (Update Exit Time)
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(
            2, 
            expect.stringContaining('UPDATE visits'),
            [
                { name: "exitTime", type: expect.any(Function), value: expect.any(String) }, 
                { name: "visitId", type: expect.any(Function), value: ACTIVE_VISIT_ID },
            ]
        );

        // Assert no error was logged
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    // --- Test 2: Visitor Not Found / Already Signed Out ---
    test('should return 404 if no active visit is found', async () => {
        // Mock the first call (SELECT): Returns an empty array
        mockDbService.executeQuery.mockResolvedValueOnce([]); 

        const response = await request(app)
            .post(`/exit-visitor/${TEST_ID}`)
            .expect('Content-Type', /json/)
            .expect(404);

        // Assert response message
        expect(response.body.message).toBe('Visitor not found or already signed out.');
        
        // Assert only one DB call was made (the initial select)
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);

        // Assert no error was logged
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    // --- Test 3: Database Error on Initial Find ---
    test('should return 500 and log error if database fails to find active visit', async () => {
        const dbError = new Error("Connection failed on SELECT");
        // Mock the first call (SELECT): Throws an error
        mockDbService.executeQuery.mockRejectedValueOnce(dbError); 

        const response = await request(app)
            .post(`/exit-visitor/${TEST_ID}`)
            .expect('Content-Type', /json/)
            .expect(500);

        // Assert response message
        expect(response.body.error).toBe('A database error occurred during sign-out.');
        
        // Assert one DB call was made
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);

        // Assert error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Azure SQL Error in /exit-visitor:", dbError.message
        );
    });

    // --- Test 4: Database Error on Update ---
    test('should return 500 and log error if database fails to update the exit time', async () => {
        const dbError = new Error("Transaction failed on UPDATE");
        // 1. Mock the first call (SELECT): Returns an active visit row
        mockDbService.executeQuery.mockResolvedValueOnce(mockActiveVisitRow); 
        
        // 2. Mock the second call (UPDATE): Throws an error
        mockDbService.executeQuery.mockRejectedValueOnce(dbError); 

        const response = await request(app)
            .post(`/exit-visitor/${TEST_ID}`)
            .expect('Content-Type', /json/)
            .expect(500);

        // Assert response message
        expect(response.body.error).toBe('A database error occurred during sign-out.');
        
        // Assert two DB calls were attempted
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(2);

        // Assert error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Azure SQL Error in /exit-visitor:", dbError.message
        );
    });
});
