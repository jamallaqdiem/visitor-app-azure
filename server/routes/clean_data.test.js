const sql = require("mssql");
const runDataComplianceCleanup = require('./clean_data');

// Mock the core components
jest.mock('mssql', () => ({
    NVarChar: 'NVarChar', 
    Int: 'Int',
}));

describe('runDataComplianceCleanup', () => {
    let mockDbService;
    let mockCallback;
    let consoleLogSpy;
    let consoleErrorSpy;
    
    // Define a fixed current time for deterministic date calculation 
    const MOCK_CURRENT_TIME = new Date('2025-10-25T10:00:00.000Z').getTime();
    const MOCK_TWO_YEARS_AGO = new Date(MOCK_CURRENT_TIME - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    
    // Define the expected SQL strings for verification
    const expectedSql = {
        deleteDependents: expect.stringContaining('DELETE FROM dependents'),
        deleteVisits: expect.stringContaining('DELETE FROM visits'),
        deleteVisitors: expect.stringContaining('DELETE FROM visitors'),
        insertAudit: expect.stringContaining('INSERT INTO audit_logs'),
    };


    beforeEach(() => {
        // Mock Date.now() to ensure the 'twoYearsAgo' calculation is consistent
        jest.spyOn(Date, 'now').mockReturnValue(MOCK_CURRENT_TIME);
        
        // Mock logging functions
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock the dbService
        mockDbService = {
            executeQuery: jest.fn(),
        };

        // Mock the callback
        mockCallback = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore mocks after each test
    });

    // --- Scenario 1: Successful Cleanup ---
    test('should execute all deletion steps and log a successful audit entry', async () => {
        // 1. Setup Mock Results for 4 sequential calls:
        mockDbService.executeQuery
            // 1. Dependents DELETE (5 rows affected)
            .mockResolvedValueOnce({ rowsAffected: [5] }) 
            // 2. Visits DELETE (10 rows affected)
            .mockResolvedValueOnce({ rowsAffected: [10] }) 
            // 3. Visitor Profiles DELETE (3 rows affected)
            .mockResolvedValueOnce({ rowsAffected: [3] }) 
            // 4. Audit Log INSERT (success)
            .mockResolvedValueOnce({}); 

        // 2. Run the cleanup job
        await runDataComplianceCleanup(mockDbService, mockCallback);

        // 3. Assertions
        
        // Check that all 4 DB calls were attempted
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(4);
        
        // Check parameters of the first call (Dependents DELETE)
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(1, 
            expectedSql.deleteDependents,
            [{ name: "twoYearsAgo", type: 'NVarChar', value: MOCK_TWO_YEARS_AGO }]
        );

        // Check the final Audit Log entry parameters (4th call)
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(4, 
            expectedSql.insertAudit,
            expect.arrayContaining([
                expect.objectContaining({ name: "eventName", value: "Compliance Cleanup Succeeded" }),
                expect.objectContaining({ name: "status", value: "OK" }),
                expect.objectContaining({ name: "profilesDeleted", value: 3 }),
                expect.objectContaining({ name: "visitsDeleted", value: 10 }),
                expect.objectContaining({ name: "dependentsDeleted", value: 5 }),
            ])
        );

        // Check logging output
        expect(consoleLogSpy).toHaveBeenCalledWith('Cleanup: Deleted 5 old dependent record(s).');
        
        // Check the final callback call 
        expect(mockCallback).toHaveBeenCalledWith('');
    });

    // --- Scenario 2: Database Failure during Deletion ---
    test('should stop execution on error and log a failed audit entry', async () => {
        const DB_ERROR_MESSAGE = 'A DB connection error occurred.';

        // 1. Setup Mock Results for 2 sequential calls:
        mockDbService.executeQuery
            // 1. Dependents DELETE (Success, 2 rows affected)
            .mockResolvedValueOnce({ rowsAffected: [2] }) 
            // 2. Visits DELETE (FAILURE)
            .mockRejectedValueOnce(new Error(DB_ERROR_MESSAGE)) 
            // 3. Audit Log INSERT (The only remaining DB call in the finally block)
            .mockResolvedValueOnce({}); 

        // 2. Run the cleanup job
        await runDataComplianceCleanup(mockDbService, mockCallback);

        // 3. Assertions

        // Check that only 3 DB calls were attempted (Dependents, Visits fail, then Audit log)
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(3); 
        
        // Check error logging
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Cleanup Error: ${DB_ERROR_MESSAGE}`);
        
        // Check the final Audit Log entry parameters (3rd call)
        expect(mockDbService.executeQuery).toHaveBeenNthCalledWith(3, 
            expectedSql.insertAudit,
            expect.arrayContaining([
                expect.objectContaining({ name: "eventName", value: "Compliance Cleanup Failed" }),
                expect.objectContaining({ name: "status", value: "ERROR" }),
                expect.objectContaining({ name: "dependentsDeleted", value: 2 }),
                expect.objectContaining({ name: "visitsDeleted", value: 0 }),
                expect.objectContaining({ name: "profilesDeleted", value: 0 }),
            ])
        );

        // Check the final callback call (with the error message)
        expect(mockCallback).toHaveBeenCalledWith(DB_ERROR_MESSAGE);
    });
    
    // --- Scenario 3: Fatal Audit Log Failure (Should still call main callback) ---
    test('should handle audit log failure and still call the main callback', async () => {
        const AUDIT_ERROR_MESSAGE = 'Audit table is down.';

        // 1. Setup Mock Results for 4 sequential calls:
        mockDbService.executeQuery
            // 1. Dependents DELETE (Success)
            .mockResolvedValueOnce({ rowsAffected: [1] }) 
            // 2. Visits DELETE (Success)
            .mockResolvedValueOnce({ rowsAffected: [1] }) 
            // 3. Visitor Profiles DELETE (Success)
            .mockResolvedValueOnce({ rowsAffected: [1] }) 
            // 4. Audit Log INSERT (FAILURE)
            .mockRejectedValueOnce(new Error(AUDIT_ERROR_MESSAGE)); 

        // 2. Run the cleanup job
        await runDataComplianceCleanup(mockDbService, mockCallback);

        // 3. Assertions

        // Check that all 4 DB calls were attempted
        expect(mockDbService.executeQuery).toHaveBeenCalledTimes(4);
        
        // Check fatal error logging
        expect(consoleErrorSpy).toHaveBeenCalledWith('FATAL: Could not write audit log:', AUDIT_ERROR_MESSAGE);
        
        // Check the final callback call (since the main try block succeeded, it returns no error)
        expect(mockCallback).toHaveBeenCalledWith('');
    });
});
