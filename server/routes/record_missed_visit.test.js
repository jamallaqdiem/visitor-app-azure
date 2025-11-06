const request = require('supertest');
const express = require('express');
const createMissedVisitRouter = require('./record_missed_visit'); 

// --- Mocking Setup ---

const mockSqlTypes = {
    Int: jest.fn(),
    NVarChar: jest.fn(),
};

// Mock the core database service
const mockDbService = {
    // Default mock response: empty recordset
    executeQuery: jest.fn().mockResolvedValue({ recordset: [] }), 
};

// Fixed timestamps for predictable results in the tests.
const MOCK_CURRENT_TIMESTAMP = 1700000000000; 
const MOCK_PAST_ISO = '2023-11-13T13:06:40.000Z'; 
const ONE_HOUR_MS = 3600000; 

const TEST_VISITOR_ID = 101;
const GOOD_BODY = { visitorId: TEST_VISITOR_ID, pastEntryTime: MOCK_PAST_ISO };

// Variable to hold the spy instance so we can restore it correctly later
let dateNowSpy;

function setupTestApp() {
    const app = express();
    app.use(express.json());
    // Pass the mock types to the router logic for parameter binding
    const mockRouter = createMissedVisitRouter({
        ...mockDbService,
        sql: mockSqlTypes
    });
    app.use('/', mockRouter);
    return app;
}

describe('POST /record-missed-visit', () => {
    let app;
    let consoleErrorSpy;

    beforeAll(() => {
        dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(MOCK_CURRENT_TIMESTAMP);
    });

    beforeEach(() => {
        mockDbService.executeQuery.mockClear(); // reset before each unit test
        // Set up spy for console.error
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        app = setupTestApp(); // clean app express each test time
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore(); 
    });

    afterAll(() => {
        // Correctly restore Date.now mock ensuring other tests aren't using the fixed mocked time
        if (dateNowSpy) {
            dateNowSpy.mockRestore(); 
        }
    });

    // --- Validation Tests (400) ---
    test('should return 400 if visitorId is missing', async () => {
        await request(app)
            .post('/record-missed-visit')
            .send({ pastEntryTime: MOCK_PAST_ISO })
            .expect('Content-Type', /json/)
            .expect(400, { message: "Missing visitor ID or required entry time." });
    });

    test('should return 400 if pastEntryTime is missing', async () => {
        await request(app)
            .post('/record-missed-visit')
            .send({ visitorId: TEST_VISITOR_ID })
            .expect('Content-Type', /json/)
            .expect(400, { message: "Missing visitor ID or required entry time." });
    });

    test('should return 400 if pastEntryTime is an invalid date string', async () => {
        await request(app)
            .post('/record-missed-visit')
            .send({ visitorId: TEST_VISITOR_ID, pastEntryTime: 'not-a-real-date' })
            .expect('Content-Type', /json/)
            .expect(400, { message: "Invalid entry time. It must be a valid date/time and occur before the current exit time." });
    });

    test('should return 400 if pastEntryTime is in the future or equals the current time', async () => {
        // Using the constant mock value to generate a time that is in the future
        const FUTURE_TIME_MS = MOCK_CURRENT_TIMESTAMP + ONE_HOUR_MS;
        const FUTURE_TIME = new Date(FUTURE_TIME_MS).toISOString(); 
        
        await request(app)
            .post('/record-missed-visit')
            .send({ visitorId: TEST_VISITOR_ID, pastEntryTime: FUTURE_TIME })
            .expect('Content-Type', /json/)
            .expect(400, { message: "Invalid entry time. It must be a valid date/time and occur before the current exit time." });
    });


    // --- Success Tests (200) ---

    test('should record the missed visit using details from the last visit and return 200', async () => {
        const mockLastVisit = [{
            known_as: 'Jamie',
            address: '123 Main St',
            phone_number: '555-1234',
            unit: 'Admin',
            reason_for_visit: 'Meeting',
            type: 'Staff',
            company_name: 'SA HQ',
            mandatory_acknowledgment_taken: 'Yes'
        }];
        
        // Mock DB calls: 1. SELECT returns last visit data. 2. INSERT succeeds.
        mockDbService.executeQuery.mockResolvedValueOnce({ recordset: mockLastVisit }); 
        mockDbService.executeQuery.mockResolvedValueOnce({}); 

        const response = await request(app)
            .post('/record-missed-visit')
            .send(GOOD_BODY)
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body.message).toBe("Visitor Entry Time Corrected & Signed Out");
        expect(response.body.entry).toBe(MOCK_PAST_ISO);
        // Relax assertion for the response body exit time value
        expect(response.body.exit).toEqual(expect.any(String)); 
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(2); // 2 database calls were made(SELECT, INSERT)

        // Assert the second call (INSERT) has correct, non-default parameters
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('INSERT INTO visits'),
            [
                { name: "visitorId", type: expect.any(Function), value: TEST_VISITOR_ID },
                { name: "entryTime", type: expect.any(Function), value: MOCK_PAST_ISO },
                // Relax assertion for the DB input exit time value
                { name: "exitTime", type: expect.any(Function), value: expect.any(String) }, 
                { name: "knownAs", type: expect.any(Function), value: 'Jamie' },
                { name: "address", type: expect.any(Function), value: '123 Main St' },
                { name: "phoneNumber", type: expect.any(Function), value: '555-1234' },
                { name: "unit", type: expect.any(Function), value: 'Admin' },
                { name: "reasonForVisit", type: expect.any(Function), value: 'Meeting' },
                { name: "type", type: expect.any(Function), value: 'Staff' }, 
                { name: "companyName", type: expect.any(Function), value: 'SA HQ' },
                { name: "mandatoryTaken", type: expect.any(Function), value: 'Yes' }
            ]
        );
        expect(consoleErrorSpy).not.toHaveBeenCalled();// No server-side errors were logged during the insert
    });

    test('should record the missed visit using default details if no previous visit exists', async () => {
        // Mock DB calls: 1. SELECT returns empty. 2. INSERT succeeds.
        mockDbService.executeQuery.mockResolvedValueOnce({ recordset: [] }); 
        mockDbService.executeQuery.mockResolvedValueOnce({}); 

        await request(app)
            .post('/record-missed-visit')
            .send(GOOD_BODY)
            .expect(200);

        // Assert the second call INSERT has correct default parameters
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('INSERT INTO visits'),
            [
                { name: "visitorId", type: expect.any(Function), value: TEST_VISITOR_ID },
                { name: "entryTime", type: expect.any(Function), value: MOCK_PAST_ISO },
                // Relax assertion for the DB input exit time value
                { name: "exitTime", type: expect.any(Function), value: expect.any(String) }, 
                { name: "knownAs", type: expect.any(Function), value: '--' }, // Default
                { name: "address", type: expect.any(Function), value: '--' }, // Default
                { name: "phoneNumber", type: expect.any(Function), value: null }, // Default
                { name: "unit", type: expect.any(Function), value: "--" }, // Default
                { name: "reasonForVisit", type: expect.any(Function), value: null }, // Default
                { name: "type", type: expect.any(Function), value: "Visitor" }, // Default
                { name: "companyName", type: expect.any(Function), value: null }, // Default
                { name: "mandatoryTaken", type: expect.any(Function), value: '--' } // Default
            ]
        );
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    // --- Failure Tests (500) ---

    test('should return 500 if the initial SELECT query fails', async () => {
        const dbError = new Error("Connection failed on SELECT");
        mockDbService.executeQuery.mockRejectedValueOnce(dbError); 

        const response = await request(app)
            .post('/record-missed-visit')
            .send(GOOD_BODY)
            .expect('Content-Type', /json/)
            .expect(500);

        expect(response.body.error).toContain("Failed to record historical visit due to database error: Connection failed on SELECT");
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Azure SQL Error in /record-missed-visit:", dbError.message
        );
    });

    test('should return 500 if the INSERT query fails', async () => {
        const dbError = new Error("Transaction failed on INSERT");
        
        // Mock DB calls: 1. SELECT succeeds. 2. INSERT fails.
        mockDbService.executeQuery.mockResolvedValueOnce({ recordset: [] }); 
        mockDbService.executeQuery.mockRejectedValueOnce(dbError); 

        const response = await request(app)
            .post('/record-missed-visit')
            .send(GOOD_BODY)
            .expect('Content-Type', /json/)
            .expect(500);

        expect(response.body.error).toContain("Failed to record historical visit due to database error: Transaction failed on INSERT");
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(2);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Azure SQL Error in /record-missed-visit:", dbError.message
        );
    });
});
