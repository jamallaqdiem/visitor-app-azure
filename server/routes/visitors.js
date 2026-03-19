const express = require("express");
const sql = require("mssql");

/**
 * Creates and configures a router for fetching currently signed-in visitor data
 * using Azure SQL.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the visitor endpoints.
 */
function createVisitorsRouter(dbService) {
  const router = express.Router();

  router.get("/visitors", async (req, res) => {
    const query = `
      SELECT 
        v.id, 
        v.first_name, 
        v.last_name, 
        v.photo_path, 
        v.is_banned,
        vt.id AS visit_id,
        vt.entry_time,
        vt.known_as,
        vt.address,
        vt.phone_number,
        vt.unit,
        vt.reason_for_visit,
        vt.type,
        vt.company_name,
        vt.mandatory_acknowledgment_taken,
        (
          SELECT full_name, age 
          FROM dependents 
          WHERE visit_id = vt.id 
          FOR JSON PATH
        ) AS additional_dependents
      FROM visitors v
      INNER JOIN visits vt ON v.id = vt.visitor_id
      WHERE vt.exit_time IS NULL
      ORDER BY vt.entry_time DESC;
    `;

    try {
      const result = await dbService.executeQuery(query);

      // Safety check: ensure result and recordset exist
      const rows = result && result.recordset ? result.recordset : [];

      const resultsWithUrls = rows.map((row) => {
        let dependentsData = [];

        // Azure SQL FOR JSON PATH handling
        if (row.additional_dependents) {
          try {
            dependentsData =
              typeof row.additional_dependents === "string"
                ? JSON.parse(row.additional_dependents)
                : row.additional_dependents;
          } catch (parseErr) {
            console.error("JSON Parse Error:", parseErr.message);
          }
        }

        return {
          ...row,
          is_banned: row.is_banned === true || row.is_banned === 1,
          //  The frontend gets the exact field name it is looking for
          photo_path: row.photo_path,
          dependents: dependentsData,
          additional_dependents: undefined,
        };
      });

      res.json(resultsWithUrls);
    } catch (err) {
      console.error(" Azure SQL Error in GET /visitors:", err.message);
      res
        .status(500)
        .json({ error: "Failed to retrieve active visitor data." });
    }
  });

  return router;
}

module.exports = createVisitorsRouter;
