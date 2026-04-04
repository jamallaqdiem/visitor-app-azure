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
    const siteId = req.siteId;

    try {
      // Use the new DateTimeOffset type for Azure compatibility
      const exit_time = new Date().toISOString();

      // 1. Find the active visit  recordset check
      const findSql = `
        SELECT TOP 1 
          T1.id AS visit_id, 
          T2.first_name, 
          T2.last_name 
        FROM visits T1 
        JOIN visitors T2 ON T1.visitor_id = T2.id 
        WHERE T1.visitor_id = @visitorId AND T1.exit_time IS NULL AND T1.site_id = @siteId
        ORDER BY T1.entry_time DESC
      `;

      const findInputs = [
        { name: "visitorId", type: sql.Int, value: visitorId },
        { name: "siteId", type: sql.Int, value: siteId },
      ];
      const result = await dbService.executeQuery(findSql, findInputs);

      const activeVisit = result?.recordset?.[0];

      if (!activeVisit) {
        return res
          .status(404)
          .json({ message: "Visitor not found or already signed out." });
      }

      // 2. Perform the Update with correct SQL Types
      const updateSql = `
        UPDATE visits 
        SET exit_time = @exitTime 
        WHERE id = @visitId
        AND site_id = @siteId
      `;

      const updateInputs = [
        { name: "exitTime", type: sql.DateTimeOffset, value: exit_time },
        { name: "visitId", type: sql.Int, value: activeVisit.visit_id },
        { name: "siteId", type: sql.Int, value: siteId },
      ];

      await dbService.executeQuery(updateSql, updateInputs);

      res.status(200).json({
        message: `${activeVisit.first_name} ${activeVisit.last_name} has been signed out.`,
      });
    } catch (err) {
      // This will use the  new 'pool = null' logic from executeQuery if it fails!
      console.error("Azure SQL Error in /exit-visitor:", err.message);
      res.status(500).json({ error: "Database error during sign-out." });
    }
  });

  return router;
}

module.exports = createLogoutRouter;
