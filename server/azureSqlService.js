const sql = require("mssql");
const { DefaultAzureCredential } = require("@azure/identity");

// Configuring connection using environment variables.
const config = { 
  server: process.env.DB_SERVER, 
  database: process.env.DB_NAME, 
  port: parseInt(process.env.DB_PORT || '1433', 10),
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

async function connectDb() {
  try {
    // 1. Get the Default Azure Credential
    const credential = new DefaultAzureCredential();

    // 2. Explicitly acquire the access token for the Azure SQL resource endpoint.
    console.log("Acquiring token via Managed Identity...");
    const accessToken = await credential.getToken("https://database.windows.net/.default"); 

    // 3. Define the configuration using 'azure-active-directory-access-token'
    const finalConfig = {
      ...config,
      authentication: {
        type: 'azure-active-directory-access-token', // Changed type to token-based
        options: {
          token: accessToken.token // CORRECT: Pass the string token here
        }
      }
    };
    
    console.log("Attempting to connect to Azure SQL...");
    pool = await sql.connect(finalConfig);
    console.log("✅ Azure SQL connection pool created successfully.");
    return pool;
  } catch (err) {
    console.error("CRITICAL ERROR: Initial database connection failed.", err);
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
