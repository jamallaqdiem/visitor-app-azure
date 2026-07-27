const sql = require("mssql");
const { DefaultAzureCredential } = require("@azure/identity");

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: false,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;

async function connectDb() {
  try {
    // 1. Check if pool exists
    if (pool) {
      if (pool.connected) {
        try {
          //  A health check
          // If the network was cut, this will fail immediately
          await pool.request().query("SELECT 1");
          return pool;
        } catch (pingErr) {
          console.log(
            "📡 Connection stale or network changed. Reconnecting...",
          );
          try {
            await pool.close();
          } catch (e) {
            /* ignore */
          }
          pool = null; // Force a fresh start below
        }
      } else {
        pool = null;
      }
    }

    let finalConfig;
    if (process.env.DB_USER && process.env.DB_PASSWORD) {
      console.log("🔐 Using SQL Authentication...");
      finalConfig = {
        ...config,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        authentication: { type: "default" },
      };
    } else {
      console.log("☁️ Acquiring Azure Token...");
      const credential = new DefaultAzureCredential();
      const accessToken = await credential.getToken(
        "https://database.windows.net/.default",
      );
      finalConfig = {
        ...config,
        authentication: {
          type: "azure-active-directory-access-token",
          options: { token: accessToken.token },
        },
      };
    }

    // 3. Create the new connection
    pool = await new sql.ConnectionPool(finalConfig).connect();
    console.log("✅ Azure SQL connection pool created successfully.");
    return pool;
  } catch (err) {
    console.error("CRITICAL ERROR: Initial database connection failed.", err);
    pool = null; // Reset so we can try again next time
    throw err;
  }
}

async function executeQuery(querySql, params = [], retries = 3) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      // 1. Get an active pool (our connectDb now handles the health check!)
      const activePool = await connectDb();

      const request = activePool.request();
      for (const param of params) {
        request.input(param.name, param.type, param.value);
      }

      // 2. Try the query
      return await request.query(querySql);
    } catch (err) {
      lastError = err;

      // 3. Check if the error is "Transient" (meaning it's worth retrying)
      const isNetworkError =
        err.code === "EAI_AGAIN" ||
        err.code === "ENOTFOUND" ||
        err.message.includes("closed") ||
        err.message.includes("connection") ||
        err.message.includes("timeout") ||
        err.message.includes("socket");

      if (isNetworkError && i < retries - 1) {
        const delay = (i + 1) * 2000; // Wait 1s, then 4s
        console.warn(
          `⚠️ Connection lost. Retry ${i + 1}/${retries} in ${delay}ms...`,
        );

        // Force pool reset so next attempt starts fresh
        pool = null;

        // Wait before next attempt
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      // 4. If it's a code error throw it
      console.error(`❌ SQL Execution Final Failure:`, err.message);
      throw new Error(`Database error: ${err.message}`);
    }
  }
}

async function logAudit({
  eventName,
  status,
  siteId,
  profilesDeleted = 0,
  visitsDeleted = 0,
  dependentsDeleted = 0,
}) {
  const query = `
        INSERT INTO audit_logs (event_name, timestamp, status, site_id, profiles_deleted, visits_deleted, dependents_deleted)
        VALUES (@eventName, GETUTCDATE(), @status, @siteId, @profilesDeleted, @visitsDeleted, @dependentsDeleted);
    `;
  const params = [
    { name: "eventName", type: sql.NVarChar(255), value: eventName },
    { name: "status", type: sql.NVarChar(50), value: status },
    { name: "siteId", type: sql.Int, value: siteId },
    { name: "profilesDeleted", type: sql.Int, value: profilesDeleted },
    { name: "visitsDeleted", type: sql.Int, value: visitsDeleted },
    { name: "dependentsDeleted", type: sql.Int, value: dependentsDeleted },
  ];

  try {
    await executeQuery(query, params);
    console.log(`Audit log recorded: ${eventName}`);
  } catch (err) {
    console.error("CRITICAL: Failed to log audit event.", err.message);
  }
}

module.exports = { connectDb, executeQuery, logAudit, sqlTypes: sql };
