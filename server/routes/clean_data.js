const sql = require("mssql");

/**
 * Executes the data retention compliance cleanup job for Azure SQL.
 * Deletes records older than 2 years from dependents, visits, and finally visitors.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (with executeQuery).
 * @param {function} callback - Callback function to signal job completion or error.
 */
async function runDataComplianceCleanup(dbService, callback) {
    const log = (message) => console.log(message);
    
    log('--- Starting Data Retention Compliance Cleanup Job (Async/Await) ---');

    let deletedCounts = { dependents: 0, visits: 0, profiles: 0 };
    
    // Calculate the cutoff date (2 years ago)
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    
    let auditStatus = 'OK';
    let auditEvent = 'Compliance Cleanup Succeeded';
    let errorMessage = '';

    try {
        // --- 1. Deleting Dependents (where parent visit is old) ---
        const deleteDependentsSql = `
            DELETE FROM dependents
            WHERE visit_id IN (
                SELECT id FROM visits WHERE entry_time < @twoYearsAgo
            );
        `;
        
        const params = [{ name: "twoYearsAgo", type: sql.NVarChar, value: twoYearsAgo }];
        
        // executeQuery for DELETE returns an object including rowsAffected
        let result = await dbService.executeQuery(deleteDependentsSql, params);
        
        deletedCounts.dependents = result.rowsAffected ? result.rowsAffected[0] : 0;
        log(`Cleanup: Deleted ${deletedCounts.dependents} old dependent record(s).`);

        // --- 2. Deleting Visits (older than 2 years) ---
        const deleteVisitsSql = `DELETE FROM visits WHERE entry_time < @twoYearsAgo`;
        
        result = await dbService.executeQuery(deleteVisitsSql, params);
        
        deletedCounts.visits = result.rowsAffected ? result.rowsAffected[0] : 0;
        log(`Cleanup: Deleted ${deletedCounts.visits} old visit record(s).`);

        // --- 3. Deleting Visitor Profiles (who have no remaining visits) ---
        const deleteVisitorsSql = `
            DELETE FROM visitors
            WHERE id NOT IN (SELECT visitor_id FROM visits)
            AND is_banned = 0;
        `;
        // No parameters needed 
        result = await dbService.executeQuery(deleteVisitorsSql, []); 
        
        deletedCounts.profiles = result.rowsAffected ? result.rowsAffected[0] : 0;
        log(`Cleanup: Deleted ${deletedCounts.profiles} inactive visitor profile(s).`);

    } catch (error) {
        auditStatus = 'ERROR';
        auditEvent = 'Compliance Cleanup Failed';
        errorMessage = error.message;
        console.error(`Cleanup Error: ${errorMessage}`);
    } finally {
        log('--- Data Retention Compliance Cleanup Job Complete ---');

        // --- 4. Writing Audit Log ---
        const auditLogSql = `
            INSERT INTO audit_logs (event_name, timestamp, status, profiles_deleted, visits_deleted, dependents_deleted)
            VALUES (@eventName, @timestamp, @status, @profilesDeleted, @visitsDeleted, @dependentsDeleted);
        `;
        const timestamp = new Date().toISOString();
        const auditParams = [
            { name: "eventName", type: sql.NVarChar, value: auditEvent },
            { name: "timestamp", type: sql.NVarChar, value: timestamp },
            { name: "status", type: sql.NVarChar, value: auditStatus },
            { name: "profilesDeleted", type: sql.Int, value: deletedCounts.profiles },
            { name: "visitsDeleted", type: sql.Int, value: deletedCounts.visits },
            { name: "dependentsDeleted", type: sql.Int, value: deletedCounts.dependents },
        ];

        try {
            await dbService.executeQuery(auditLogSql, auditParams);
            log(`Audit Log written successfully: ${auditEvent}.`);
        } catch (auditError) {
            console.error('FATAL: Could not write audit log:', auditError.message);
        }
        
        // Execute the original callback function
        if (callback) {
            callback(errorMessage);
        }
    }
}

module.exports = runDataComplianceCleanup;
