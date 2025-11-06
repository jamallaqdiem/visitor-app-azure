const express = require("express");
const sql = require("mssql");

/**
 * Creates and configures a router for handling visitor search using Azure SQL.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the search endpoint.
 */
function createSearchVisitorsRouter(dbService,sql) {
  const router = express.Router();

  // Endpoint to search for visitors by name
  router.get("/visitor-search", async (req, res) => {
    const searchTerm = req.query.name;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term 'name' is required." });
    }

    // 1. Prepare search terms and parameters
    const searchTerms = searchTerm.split(" ").filter(t => t.length > 0);
    const likeTerms = searchTerms.map(term => `%${term}%`);

    if (searchTerms.length === 0) {
        return res.status(400).json({ message: "Search term is required and cannot be empty." });
    }

    let whereClauses = [];
    let inputs = [];

    // Dynamically build conditions for each search term
    searchTerms.forEach((_, index) => {
        // Create a unique parameter name for each pair of LIKE conditions
        const paramName = `term${index}`;
        whereClauses.push(`(T1.first_name LIKE @${paramName} OR T1.last_name LIKE @${paramName})`);
        
        // Add the parameter to the inputs array
        inputs.push({ name: paramName, type: sql.NVarChar, value: likeTerms[index] });
    });

    const whereClause = "WHERE " + whereClauses.join(' AND ');

    // 2. Construct the main T-SQL query
    const query = `
      SELECT
        T1.id,
        T1.first_name,
        T1.last_name,
        T1.photo_path,
        T1.is_banned,
        T2.known_as,
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
        ) AS dependents_json
      FROM visitors AS T1
      OUTER APPLY (
        SELECT TOP 1 
            id, known_as, address, phone_number, unit, reason_for_visit, company_name, type, mandatory_acknowledgment_taken
        FROM visits
        WHERE visitor_id = T1.id
        ORDER BY entry_time DESC
      ) AS T2
      ${whereClause}
      ORDER BY T1.id -- Order results consistently
    `;

    try {
      // 3. Execute the query
      const rows = await dbService.executeQuery(query, inputs);

      // 4. Process results to clean up data and parse JSON dependents
      const resultsWithUrls = rows.map((row) => {
        let dependentsData = [];
        
        if (row.dependents_json) {
          try {
            dependentsData = JSON.parse(row.dependents_json);
          } catch (parseErr) {
            console.error("Failed to parse dependents JSON:", parseErr.message);
          }
        }
        
        return {
          ...row,
          // Construct the full photo URL for the client
          photo: row.photo_path
            ? `${req.protocol}://${req.get("host")}/${row.photo_path}`
            : null,
          dependents: dependentsData,
          // Remove raw photo path from the final output for cleaner data structure
          photo_path: undefined,
          dependents_json: undefined,
        };
      });

      res.status(200).json(resultsWithUrls);
    } catch (err) {
      console.error("Azure SQL Error in /visitor-search:", err.message);
      res.status(500).json({ error: "Failed to search visitors due to a database error." });
    }
  });

  return router;
}

module.exports = createSearchVisitorsRouter;
