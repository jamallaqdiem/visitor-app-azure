const sql = require("mssql");

// Configuring connection using environment variables.
const config = {
  user: process.env.DB_USER, 
  password: process.env.DB_PASSWORD, 
  server: process.env.DB_SERVER, 
  database: process.env.DB_NAME, 
  options: {
    encrypt: true, 
    enableArithAbort: true,
    trustServerCertificate: false, 
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

/**
 * Initializes the Azure SQL connection pool and must be called before
 * the server starts accepting requests.
 */
async function connectDb() {
  try {
    console.log("Attempting to connect to Azure SQL...");
    pool = await sql.connect(config);
    console.log("✅ Azure SQL connection pool created successfully.");
    return pool;
  } catch (err) {
    console.error(
      "❌ FATAL: Database Connection Failed. Check DB_SERVER, DB_USER, DB_PASSWORD, and DB_NAME in your .env file.",
      err.message
    );
    throw err;
  }
}

/**
 * Core secure query execution function. Used by all routers.
 * @param {string} querySql The T-SQL query string.
 * @param {Array<{name: string, type: any, value: any}>} params Array of parameters for security.
 * @returns {Promise<Array<Object>>} The results from the query.
 */
async function executeQuery(querySql, params = []) {
  if (!pool) {
    throw new Error(
      "Database connection pool is not initialized. Call connectDb() first."
    );
  }

  try {
    const request = pool.request();
    // Add parameters to prevent SQL Injection 
    for (const param of params) {
      request.input(param.name, param.type, param.value);
    }

    const result = await request.query(querySql);
    return result.recordset;
  } catch (err) {
    console.error("SQL Execution Error:", err.message);
    throw new Error(`Database error during execution: ${err.message}`);
  }
}

//Logs an event into the AuditLogs table.
async function logAudit({
  eventName,
  status,
  profilesDeleted = 0,
  visitsDeleted = 0,
  dependentsDeleted = 0,
}) {
  const query = `
        INSERT INTO AuditLogs (EventName, Timestamp, Status, ProfilesDeleted, VisitsDeleted, DependentsDeleted)
        VALUES (@eventName, GETUTCDATE(), @status, @profilesDeleted, @visitsDeleted, @dependentsDeleted);
    `;
  const params = [
    { name: "eventName", type: sql.NVarChar(255), value: eventName },
    { name: "status", type: sql.NVarChar(50), value: status },
    { name: "profilesDeleted", type: sql.Int, value: profilesDeleted },
    { name: "visitsDeleted", type: sql.Int, value: visitsDeleted },
    { name: "dependentsDeleted", type: sql.Int, value: dependentsDeleted },
  ];

  try {
    await executeQuery(query, params);
    console.log(`Audit log recorded: ${eventName} - ${status}`);
  } catch (err) {
    console.error("CRITICAL: Failed to log audit event.", err.message);
    // Continue application flow even if audit logging fails
  }
}

module.exports = {
  connectDb,
  executeQuery,
  logAudit,
  sqlTypes: sql, // Exporting the mssql types so routers can define parameter types (e.g., sql.Int)
};
