const express = require("express");
const sql = require("mssql");

/**
 * Creates and configures a router for fetching historical visitor data
 * with optional filtering for the administrative dashboard view, using Azure SQL.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the /history endpoint.
 */
function createHistoryRouter(dbService) {
  const router = express.Router();

  // Endpoint to use the password for authorization
  router.post("/authorize-history", (req, res) => {
    const { password } = req.body;

    // IMPORTANT: In a real application, fetch this from a secure configuration,
    // not directly from process.env on every request.
    const masterPassword = process.env.MASTER_PASSWORD2;

    if (password === masterPassword) {
      return res
        .status(200)
        .json({ success: true, message: "Authorization successful." });
    } else {
      return res.status(403).json({ message: "Incorrect password." });
    }
  });

  // Endpoint to get all historical visits with optional filtering
  router.get("/history", async (req, res) => {
    const { search, start_date, end_date } = req.query;

    let whereClauses = [];
    let inputs = [];

    // 1. Build dynamic WHERE clauses and input parameters

    if (search) {
      const searchParam = `%${search.toLowerCase()}%`;
      whereClauses.push(
        `(LOWER(T1.first_name) LIKE @searchParam OR LOWER(T1.last_name) LIKE @searchParam)`
      );
      // We only need to add the parameter once, since it's used twice in the clause
      inputs.push({
        name: "searchParam",
        type: sql.NVarChar,
        value: searchParam,
      });
    }

    if (start_date) {
      whereClauses.push(`T2.entry_time >= @startDate`);
      inputs.push({ name: "startDate", type: sql.NVarChar, value: start_date });
    }
    if (end_date) {
      // End date must include the entire day for accurate filtering
      const endOfDay = `${end_date}T23:59:59.999Z`;
      whereClauses.push(`T2.entry_time <= @endDate`);
      inputs.push({ name: "endDate", type: sql.NVarChar, value: endOfDay });
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 2. Construct the main T-SQL query
    const query = `
        SELECT
            T1.id AS visitor_id,
            T1.first_name,
            T1.last_name,
            T1.photo_path,
            T1.is_banned,
            T2.id AS visit_id,
            T2.known_as,
            T2.entry_time,
            T2.exit_time,
            T2.address,
            T2.phone_number,
            T2.unit,
            T2.reason_for_visit,
            T2.company_name,
            T2.type,
            T2.mandatory_acknowledgment_taken,
            (
                SELECT 
                    full_name, 
                    age 
                FROM dependents AS T3 
                WHERE T3.visit_id = T2.id
                FOR JSON PATH
            ) AS additional_dependents_json
        FROM visitors AS T1
        JOIN visits AS T2
            ON T1.id = T2.visitor_id
        ${whereClause}
        ORDER BY T2.entry_time DESC
    `;

    try {
      // 3. Execute the query
      const rows = await dbService.executeQuery(query, inputs);

      // 4. Process results to clean up data and parse JSON dependents
      const results = rows.map((row) => {
        let dependents = [];

        // Azure SQL's FOR JSON PATH outputs a valid JSON array string
        if (row.additional_dependents_json) {
          try {
            dependents = JSON.parse(row.additional_dependents_json);
          } catch (e) {
            console.warn(
              "Could not parse dependents JSON string:",
              row.additional_dependents_json,
              e
            );
          }
        }

        return {
          ...row,
          // Construct the full photo URL for the client
          photo: row.photo_path
            ? `${req.protocol}://${req.get("host")}/${row.photo_path}`
            : null,
          dependents: dependents,
          // Remove internal/raw fields from final output
          photo_path: undefined,
          additional_dependents_json: undefined,
        };
      });

      res.json(results);
    } catch (err) {
      console.error("Azure SQL Error in GET /history:", err.message);
      res
        .status(500)
        .json({
          error: "Failed to retrieve historical data from the database.",
        });
    }
  });

  return router;
}

module.exports = createHistoryRouter;
