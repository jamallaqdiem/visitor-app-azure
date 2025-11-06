const express = require("express");
const sql = require("mssql");
// Note: In a real environment, dotenv should be loaded early in your application's entry point, 
// but we keep the require here for context if the file runs standalone.
require('dotenv').config(); 

/**
 * Creates and configures a router for handling visitor unbanning using Azure SQL.
 * This endpoint requires a master password for authorization.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the unban endpoint.
 */
function createUnbanVisitorRouter(dbService) {
  const router = express.Router();

  // Endpoint to unban a visitor
  router.post("/unban-visitor/:id", async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    // Use the master password from the secure .env file
    const masterPassword = process.env.MASTER_PASSWORD;

    // 1. Authorization Check
    if (password !== masterPassword) {
      return res.status(403).json({ message: "Incorrect password." });
    }
    
    // Ensure ID is valid before proceeding
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ message: "Invalid Visitor ID." });
    }

    // 2. Database Update
    try {
      // T-SQL UPDATE statement with named parameter
      const sqlQuery = `UPDATE visitors SET is_banned = 0 WHERE id = @visitorId`;
      
      const inputs = [
        { name: "visitorId", type: sql.Int, value: parseInt(id) }
      ];

      // executeQuery returns the result object which contains rowsAffected
      const result = await dbService.executeQuery(sqlQuery, inputs);

      // Check if any rows were actually changed (i.e., the visitor ID existed)
      if (result.rowsAffected && result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: "Visitor not found." });
      }

      res.status(200).json({ message: `Visitor has been unbanned successfully.` });

    } catch (err) {
      console.error("Azure SQL Error unbanning visitor:", err.message);
      return res.status(500).json({ error: "Database error: " + err.message });
    }
  });

  return router;
}

module.exports = createUnbanVisitorRouter;
