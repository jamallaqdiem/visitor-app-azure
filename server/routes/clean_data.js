const sql = require("mssql");

async function runDataComplianceCleanup(dbService, callback) {
  const log = (message) => console.log(message);
  log("--- Starting Data Retention Compliance Cleanup Job ---");

  let deletedCounts = { dependents: 0, visits: 0, profiles: 0 };
  const twoYearsAgo = new Date(
    Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let auditStatus = "OK";
  let auditEvent = "Compliance Cleanup Succeeded";
  let errorMessage = "";

  try {
    const params = [
      { name: "twoYearsAgo", type: sql.DateTimeOffset, value: twoYearsAgo },
    ];

    // 1. Delete Dependents
    const deleteDependentsSql = `
            DELETE FROM dependents 
            WHERE visit_id IN (SELECT id FROM visits WHERE entry_time < @twoYearsAgo)`;
    let res1 = await dbService.executeQuery(deleteDependentsSql, params);
    deletedCounts.dependents = res1.rowsAffected[0] || 0;

    // 2. Delete Visits
    const deleteVisitsSql = `DELETE FROM visits WHERE entry_time < @twoYearsAgo`;
    let res2 = await dbService.executeQuery(deleteVisitsSql, params);
    deletedCounts.visits = res2.rowsAffected[0] || 0;

    // 3. Delete Visitors
    const deleteVisitorsSql = `
            DELETE FROM visitors 
            WHERE id NOT IN (SELECT visitor_id FROM visits) AND is_banned = 0`;
    let res3 = await dbService.executeQuery(deleteVisitorsSql, []);
    deletedCounts.profiles = res3.rowsAffected[0] || 0;

    log(
      `Cleanup Complete: ${deletedCounts.profiles} profiles, ${deletedCounts.visits} visits deleted.`,
    );
  } catch (error) {
    auditStatus = "ERROR";
    auditEvent = "Compliance Cleanup Failed";
    errorMessage = error.message;
    console.error(`Cleanup Error: ${errorMessage}`);
  } finally {
    // 4. Writing Audit Log
    const auditParams = {
      eventName: auditEvent,
      status: auditStatus,
      profilesDeleted: deletedCounts.profiles,
      visitsDeleted: deletedCounts.visits,
      dependentsDeleted: deletedCounts.dependents,
    };

    try {
      await dbService.logAudit(auditParams);
    } catch (auditError) {
      console.error("Audit log failed:", auditError.message);
    }

    if (callback) callback(errorMessage);
  }
}

module.exports = runDataComplianceCleanup;
