const fs = require("fs");
const path = require("path");
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

  // DELETE /api/visitors/:id - GDPR Permanent Erasure
  router.delete("/visitors/:id", async (req, res) => {
    const visitorId = req.params.id;
    const masterPassword =
      process.env.MASTER_PASSWORD3 || "emergency_fallback_123";
    const { password } = req.body;
    if (password !== masterPassword) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Incorrect Admin Password." });
    }

    try {
      // 1. Get the photo path first so we know what to delete from disk later
      const getPhotoQuery = `SELECT photo_path FROM visitors WHERE id = ${visitorId}`;
      const photoResult = await dbService.executeQuery(getPhotoQuery);
      const photoPath = photoResult?.recordset[0]?.photo_path;

      // 2. Start the Database Deletion Chain
      // delete in this order: Dependents -> Visits -> Visitor

      // Delete Dependents linked to any of this visitor's visits
      await dbService.executeQuery(`
        DELETE FROM dependents 
        WHERE visit_id IN (SELECT id FROM visits WHERE visitor_id = ${visitorId})
      `);

      // Delete all Visits for this visitor
      await dbService.executeQuery(
        `DELETE FROM visits WHERE visitor_id = ${visitorId}`,
      );

      // Delete the Visitor record itself
      await dbService.executeQuery(
        `DELETE FROM visitors WHERE id = ${visitorId}`,
      );

      // 3. Delete the physical photo file from the 'uploads' folder
      if (photoPath) {
        const fullPath = path.join(__dirname, "..", photoPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`Successfully deleted photo: ${fullPath}`);
        }
      }

      res.json({
        message:
          "Visitor and all associated data deleted successfully (GDPR Compliant).",
      });
    } catch (err) {
      console.error("❌ Delete Error:", err.message);
      res.status(500).json({ error: "Failed to delete visitor data." });
    }
  });

  return router;
}

module.exports = createVisitorsRouter;
