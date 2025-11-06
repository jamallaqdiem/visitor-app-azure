const request = require('supertest');
const express = require('express');
const createLoginRouter = require('./login'); 

// 1. Mock SQL Types
const mockSqlTypes = {
    Int: 'Int',
    NVarChar: jest.fn(() => 'NVarChar'), 
    DateTime: 'DateTime',
    Bit: 'Bit',
};

// 2. Mock Transaction and Request objects for the transaction block
const mockRequest = {
    input: jest.fn().mockReturnThis(), // Allows chaining: request.input().input()
    query: jest.fn(),
};

const mockTransaction = {
    begin: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
};

// 3. Mock Pool/DB Connection object
const mockPool = {
    close: jest.fn().mockResolvedValue(undefined),
    Transaction: jest.fn(() => mockTransaction),
    Request: jest.fn(() => mockRequest),
};

// --- Mock Data ---

const TEST_ID = 101;
const LAST_VISIT_ID = 456;
const NEW_VISIT_ID = 457;

const mockLastVisitDetails = {
    known_as: "Johnny Test",
    address: "10 Downing St",
    phone_number: "555-1212",
    unit: "A1",
    reason_for_visit: "Food",
    type: "Client",
    company_name: null,
    mandatory_acknowledgment_taken: true,
    last_visit_id: LAST_VISIT_ID, // Temp ID used for fetching dependents
};

const mockVisitorRow = {
    visitor_id: TEST_ID,
    is_banned: 0, 
    last_visit_data: JSON.stringify(mockLastVisitDetails),
};

const mockDependentsData = [
    { full_name: "Kid A", age: 5 },
    { full_name: "Kid B", age: 7 },
];


function setupTestApp(dbService) {
    const app = express();
    app.use(express.json());
    app.use('/', createLoginRouter(dbService));
    return app;
}


describe('POST /login', () => {
    let mockDbService;
    let app;
    let consoleErrorSpy;

    beforeEach(() => {
        // Set up spy for console.error to suppress output and allow checking if it was called
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Reset all mock pool/request/transaction function implementations
        mockTransaction.begin.mockClear();
        mockTransaction.commit.mockClear();
        mockTransaction.rollback.mockClear();
        mockRequest.query.mockClear();
        
        // Ensure call count is cleared between tests
        mockPool.close.mockClear(); 
        
        mockDbService = {
            sqlTypes: mockSqlTypes,
            executeQuery: jest.fn(),
            connectDb: jest.fn().mockResolvedValue(mockPool),
        };
        app = setupTestApp(mockDbService);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore(); 
    });

    // --- Test 1: Successful Login ---
    test('should successfully log in an existing visitor, fetch dependents, and insert new visit via transaction', async () => {
        // Mock DB Calls 
        // 1. Visitor check (executeQuery 1) returns visitor info and last visit details
        mockDbService.executeQuery.mockResolvedValueOnce([mockVisitorRow]); 
        
        // 2. Dependents check (executeQuery 2) returns dependents
        mockDbService.executeQuery.mockResolvedValueOnce(mockDependentsData); 

        // Mock Transaction Queries 
        // 3. New Visit Insert (request.query 1) returns the new visit ID
        mockRequest.query.mockResolvedValueOnce({ recordset: [{ id: NEW_VISIT_ID }] }); 
        
        // 4. Dependent Inserts (request.query 2 & 1) return nothing, just succeed
        mockRequest.query.mockResolvedValue({}); 

        const response = await request(app)
            .post('/login')
            .send({ id: TEST_ID })
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body.message).toBe('Visitor signed in successfully!');
        
        // Check the returned visitor data (should include parsed last visit details + dependents)
        expect(response.body.visitorData.dependents).toEqual(mockDependentsData);
        expect(response.body.visitorData.known_as).toBe(mockLastVisitDetails.known_as);
        expect(response.body.visitorData.last_visit_id).toBeUndefined(); // Should be cleaned up

        // Assert transaction was correctly used
        expect(mockTransaction.begin).toHaveBeenCalledTimes(1);
        expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
        expect(mockTransaction.rollback).not.toHaveBeenCalled();
        expect(mockPool.close).toHaveBeenCalledTimes(1);

        // Assert two dependents were inserted inside the transaction
        // (New Visit Insert + 2 Dependent Inserts = 3 calls)
        expect(mockRequest.query).toHaveBeenCalledTimes(3); 
    });


    // --- Test 2: Missing ID ---
    test('should return 400 if visitor ID is missing', async () => {
        const response = await request(app)
            .post('/login')
            .send({})
            .expect('Content-Type', /json/)
            .expect(400);

        expect(response.body.message).toBe('Visitor ID is required.');
        expect(mockDbService.connectDb).not.toHaveBeenCalled();
        expect(mockPool.close).not.toHaveBeenCalled();
    });

    // --- Test 3: Visitor Not Found (PASSING) ---
    test('should return 404 if visitor ID is not found in the DB', async () => {
        // Mock executeQuery 1 to return an empty array (visitor not found)
        mockDbService.executeQuery.mockResolvedValue([]); 

        const response = await request(app)
            .post('/login')
            .send({ id: TEST_ID })
            .expect('Content-Type', /json/)
            .expect(404);

        expect(response.body.message).toBe('Visitor not found.');
        
        // Connection is established and then closed in finally
        expect(mockDbService.connectDb).toHaveBeenCalledTimes(1); 
        expect(mockPool.close).toHaveBeenCalledTimes(1);
    });

    // --- Test 4: Visitor is Banned --
    test('should return 403 if the visitor is banned', async () => {
        const bannedRow = { ...mockVisitorRow, is_banned: true }; 
        // Mock executeQuery 1 to return a banned visitor
        mockDbService.executeQuery.mockResolvedValueOnce([bannedRow]); 

        const response = await request(app)
            .post('/login')
            .send({ id: TEST_ID })
            .expect('Content-Type', /json/)
            .expect(403); 

        expect(response.body.message).toBe('This visitor is banned and cannot log in.');
        
        // Connection is made and closed in finally, even on early return
        expect(mockDbService.connectDb).toHaveBeenCalledTimes(1);
        expect(mockPool.close).toHaveBeenCalledTimes(1);

        //  Ensure the router stopped correctly after the initial query.
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
        expect(mockTransaction.begin).not.toHaveBeenCalled();
    });

    // --- Test 5: Visitor found but no last visit details (PASSING) ---
    test('should return 404 if visitor is found but last_visit_data is null', async () => {
        const noLastVisitRow = { ...mockVisitorRow, last_visit_data: null };
        // Mock executeQuery 1 to return a visitor with no last visit
        mockDbService.executeQuery.mockResolvedValue([noLastVisitRow]); 

        const response = await request(app)
            .post('/login')
            .send({ id: TEST_ID })
            .expect('Content-Type', /json/)
            .expect(404);

        expect(response.body.message).toBe(
            'Visitor found but no previous visit details exist. Please register again.'
        );
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        
        // Assert connection made and closed
        expect(mockDbService.connectDb).toHaveBeenCalledTimes(1);
        expect(mockPool.close).toHaveBeenCalledTimes(1);
    });

    // --- Test 6: Database Error During Transaction (Rollback Check) (PASSING) ---
    test('should return 500 and trigger transaction rollback on insert failure', async () => {
        // 1. Visitor check (executeQuery 1) succeeds
        mockDbService.executeQuery.mockResolvedValueOnce([mockVisitorRow]); 
        
        // 2. Dependents check (executeQuery 2) succeeds
        mockDbService.executeQuery.mockResolvedValueOnce(mockDependentsData); 

        // 3. New Visit Insert (request.query 1) FAILS
        const dbError = new Error("Transaction connection failure.");
        mockRequest.query.mockRejectedValue(dbError); 

        const response = await request(app)
            .post('/login')
            .send({ id: TEST_ID })
            .expect('Content-Type', /json/)
            .expect(500);

        expect(response.body.error).toBe(
            'An unexpected database error occurred during sign-in.'
        );

        // Assert connection made and closed 
        expect(mockDbService.connectDb).toHaveBeenCalledTimes(1); 
        expect(mockPool.close).toHaveBeenCalledTimes(1);

        // Assert transaction was started and rolled back
        expect(mockTransaction.begin).toHaveBeenCalledTimes(1);
        expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
        expect(mockTransaction.commit).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled(); // Check that the failure was logged
    });
});
