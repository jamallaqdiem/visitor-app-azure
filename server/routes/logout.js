const express = require("express");
const sql = require("mssql"); // SQL types

/**
 * Creates and configures a router for handling visitor sign-out using Azure SQL.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the sign-out endpoint.
 */
function createLogoutRouter(dbService) {
  const router = express.Router();

  // Endpoint to log out a visitor by setting their exit time
  router.post("/exit-visitor/:id", async (req, res) => {
    // The visitor ID is passed as a route parameter
    const visitorId = req.params.id;
    const exit_time = new Date().toISOString();

    try {
      // 1. Find the single active visit to update for this visitor.
      const findSql = `
        SELECT TOP 1 
          T1.id AS visit_id, 
          T2.first_name, 
          T2.last_name 
        FROM visits T1 
        JOIN visitors T2 ON T1.visitor_id = T2.id 
        WHERE T1.visitor_id = @visitorId AND T1.exit_time IS NULL 
        ORDER BY T1.entry_time DESC
      `;

      const findInputs = [
        { name: "visitorId", type: sql.Int, value: visitorId },
      ];

      const rows = await dbService.executeQuery(findSql, findInputs);

      // Azure SQL returns an array of records
      const activeVisit = rows[0];

      // 2. Check if an active visit was found
      if (!activeVisit) {
        return res
          .status(404)
          .json({ message: "Visitor not found or already signed out." });
      }

      const { visit_id, first_name, last_name } = activeVisit;

      // 3. Update the visit record with the exit time
      const updateSql = `
        UPDATE visits 
        SET exit_time = @exitTime 
        WHERE id = @visitId
      `;

      const updateInputs = [
        { name: "exitTime", type: sql.NVarChar, value: exit_time },
        { name: "visitId", type: sql.Int, value: visit_id },
      ];

      // The update is performed. We don't need the result, just confirmation of completion.
      await dbService.executeQuery(updateSql, updateInputs);

      // 4. Return success response
      const fullName = `${first_name} ${last_name}`;
      res
        .status(200)
        .json({ message: `${fullName} has been successfully signed out.` });
        
    } catch (err) {
      // Handle any database or general server errors
      console.error("Azure SQL Error in /exit-visitor:", err.message);
      res.status(500).json({ error: "A database error occurred during sign-out." });
    }
  });

  return router;
}

module.exports = createLogoutRouter;
