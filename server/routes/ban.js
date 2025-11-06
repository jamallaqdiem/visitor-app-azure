const express = require("express");
const sql = require("mssql");

/**
 * Creates and configures a router for handling visitor banning status updates 
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the ban endpoint.
 */
function createBanVisitorRouter(dbService) {
  const router = express.Router();

  // Endpoint to ban a visitor by updating their is_banned status to 1
  router.post("/ban-visitor/:id", async (req, res) => {
    // Visitor ID is passed as a route parameter
    const visitorId = req.params.id;

   if (!visitorId || isNaN(parseInt(visitorId, 10))) { 
            return res.status(400).json({ message: "A valid Visitor ID is required." });
        }

    try {
      const updateSql = `
        UPDATE visitors 
        SET is_banned = 1 
        WHERE id = @visitorId
      `;
      
      const updateInputs = [
        { name: "visitorId", type: sql.Int, value: visitorId },
      ];

      // Execute the update query
      const result = await dbService.executeQuery(updateSql, updateInputs);

      // Check if any rows were affected (i.e., if the visitor ID existed)
      if (result.rowsAffected && result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: "Visitor not found." });
      }

      // If one row was affected, the ban was successful
      res.status(200).json({ message: `Visitor has been banned & signed out.` });
      
    } catch (err) {
      // Handle any database or general server errors
      console.error("Azure SQL Error banning visitor:", err.message);
      return res.status(500).json({ error: "A database error occurred while trying to ban the visitor." });
    }
  });

  return router;
}

module.exports = createBanVisitorRouter
