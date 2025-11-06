const request = require("supertest");
const express = require("express");
const createUpdateVisitorRouter = require("./update_visitor_details");

// Mock dependencies
const sql = { Int: 'Int', NVarChar: 'NVarChar' }; 

let mockDbService; 
let app;

// Store original console functions to restore them
let originalConsoleError;

// Setup the mock Express application before each test
beforeEach(() => {
    // 1. SUPPRESS console.error to keep test output clean, especially for transaction errors
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Reset the mock before each test
    mockDbService = {
        executeQuery: jest.fn(),
    };

    // Create the mock Express app
    app = express();
    app.use(express.json()); 

    // Attach the router
    const updateRouter = createUpdateVisitorRouter(mockDbService, sql); 
    app.use("/", updateRouter); 
});

// Restore console functions after each test
afterEach(() => {
    console.error = originalConsoleError;
});

describe('POST /update-visitor-details', () => {
    const API_ENDPOINT = '/update-visitor-details';
    const VISITOR_ID = 55;
    const NEW_VISIT_ID = 99;
    
    // Minimal valid body for success tests
    const VALID_BODY = {
        id: VISITOR_ID,
        known_as: "Test Known As",
        address: "123 Test St",
        phone_number: "555-1212",
        type: "CONTRACTOR",
        additional_dependents: JSON.stringify([
            { full_name: "Child A", age: 5 },
            { full_name: "Child B", age: 7 }
        ])
    };

    // --- 400 Validation Test ---
    test('should return 400 if visitor ID is missing', async () => {
        const response = await request(app)
            .post(API_ENDPOINT)
            .send({ ...VALID_BODY, id: undefined }); 
        
        expect(response.status).toBe(400); 
        expect(response.body).toHaveProperty('message', "Visitor ID is required for re-registration.");
        expect(mockDbService.executeQuery).not.toHaveBeenCalled();
    });

    // --- 404 Visitor Not Found Test  ---
    test('should return 404 and rollback if visitor ID does not exist', async () => {
        // Set up ordered mock responses for the transaction steps
        mockDbService.executeQuery
            // 1. BEGIN TRAN
            .mockResolvedValueOnce({})
            // 2. Verify visitor ID (Returns empty recordset to trigger 404)
            .mockResolvedValueOnce({ recordset: [] }); 

        const response = await request(app)
            .post(API_ENDPOINT)
            .send(VALID_BODY);
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message', "Visitor ID not found.");
        
        // Check for BEGIN TRAN and ROLLBACK TRAN
        expect(mockDbService.executeQuery).toHaveBeenCalledWith("BEGIN TRAN;");
        expect(mockDbService.executeQuery).toHaveBeenCalledWith("ROLLBACK TRAN;");
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(3); // BEGIN, Verify, ROLLBACK
    });

    // --- 201 Success Test ---
    test('should return 201 and commit transaction on successful update with dependents', async () => {
        // Set up ordered mock responses for the transaction steps
        mockDbService.executeQuery
            // 1. BEGIN TRAN;
            .mockResolvedValueOnce({})
            // 2. Verify visitor ID 
            .mockResolvedValueOnce({ recordset: [{ id: VISITOR_ID }] })
            // 3. Insert visit and retrieve new ID 
            .mockResolvedValueOnce({ recordset: [{ newVisitId: NEW_VISIT_ID }] })
            // 4. Insert Dependent 1 
            .mockResolvedValueOnce({})
            // 5. Insert Dependent 2 
            .mockResolvedValueOnce({})
            // 6. COMMIT TRAN; 
            .mockResolvedValueOnce({});
        
        const response = await request(app)
            .post(API_ENDPOINT)
            .send(VALID_BODY);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("Visitor Updated Successfully & signed in!");
        expect(response.body.id).toBe(NEW_VISIT_ID);
        
        // Check the crucial transaction calls
        expect(mockDbService.executeQuery).toHaveBeenCalledWith("BEGIN TRAN;");
        expect(mockDbService.executeQuery).toHaveBeenCalledWith("COMMIT TRAN;");
        
        // Check the total number of calls: BEGIN, VERIFY, VISIT INSERT, 2 DEPENDENT INSERTS, COMMIT = 6 calls
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(6);
        
        // Check one of the dependent inserts to ensure data processing worked
        const dependentCall = mockDbService.executeQuery.mock.calls.find(
            call => call[0].includes("INSERT INTO dependents")
        );
        expect(dependentCall).toBeDefined();
        expect(dependentCall[1][2].value).toBe(NEW_VISIT_ID); // Check visitId foreign key
        expect(dependentCall[1][0].value).toBe('Child A'); // Check data payload
    });
    
    // --- 500 Transaction Failure Test ---
    test('should return 500 and rollback if the transaction fails after verification', async () => {
        // Set up ordered mock responses for the transaction steps
        mockDbService.executeQuery
            // 1. BEGIN TRAN;
            .mockResolvedValueOnce({})
            // 2. Verify visitor ID
            .mockResolvedValueOnce({ recordset: [{ id: VISITOR_ID }] })
            // 3. Fails during the VISIT insert step (SCOPE_IDENTITY)
            .mockRejectedValueOnce(new Error("Database write failed"));
        
        const response = await request(app)
            .post(API_ENDPOINT)
            .send(VALID_BODY);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain("Database write failed");
        
        // Check for BEGIN TRAN and ROLLBACK TRAN
        expect(mockDbService.executeQuery).toHaveBeenCalledWith("BEGIN TRAN;");
        expect(mockDbService.executeQuery).toHaveBeenCalledWith("ROLLBACK TRAN;");
        
        // The total calls should be BEGIN, VERIFY, FAIL (Visits Insert), ROLLBACK = 4 calls
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(4); 
        
        // Check that console.error was called by the router's error handler
        expect(console.error).toHaveBeenCalled();
    });
});
