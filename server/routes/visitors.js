const fs = require("fs");
const path = require("path");
const express = require("express");
const sql = require("mssql");
const { BlobServiceClient } = require("@azure/storage-blob");

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "visitor-photos";
const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING,
);
const containerClient = blobServiceClient.getContainerClient(containerName);

function createVisitorsRouter(dbService) {
  const router = express.Router();

  // GET /visitors - The Live Dashboard
  router.get("/visitors", async (req, res) => {
    const siteId = req.siteId;

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
        AND vt.site_id = @siteId -- Dashboard isolation
      ORDER BY vt.entry_time DESC;
    `;

    try {
      const inputs = [{ name: "siteId", type: sql.Int, value: siteId }];
      const result = await dbService.executeQuery(query, inputs);

      const rows = result && result.recordset ? result.recordset : [];

      const resultsWithUrls = rows.map((row) => {
        let dependentsData = [];
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
      const inputs = [{ name: "visitorId", type: sql.Int, value: visitorId }];

      // 1. Get photo path
      const photoResult = await dbService.executeQuery(
        `SELECT photo_path FROM visitors WHERE id = @visitorId`,
        inputs,
      );
      const photoUrl = photoResult?.recordset[0]?.photo_path;

      // 2. Optimized Deletion Chain
      await dbService.executeQuery(
        `
        DELETE FROM dependents 
        WHERE visit_id IN (SELECT id FROM visits WHERE visitor_id = @visitorId)
      `,
        inputs,
      );

      await dbService.executeQuery(
        `DELETE FROM visits WHERE visitor_id = @visitorId`,
        inputs,
      );
      await dbService.executeQuery(
        `DELETE FROM visitors WHERE id = @visitorId`,
        inputs,
      );

      // 3. Cloud Photo Cleanup
      if (photoUrl && photoUrl.includes("http")) {
        try {
          const blobName = path.basename(photoUrl);
          const blockBlobClient = containerClient.getBlockBlobClient(blobName);
          await blockBlobClient.deleteIfExists();
        } catch (blobErr) {
          console.error("Blob deletion failed:", blobErr.message);
        }
      }

      res.json({
        message: "Visitor and all associated data deleted successfully.",
      });
    } catch (err) {
      console.error("❌ Delete Error:", err.message);
      res.status(500).json({ error: "Failed to delete visitor data." });
    }
  });

  return router;
}

module.exports = createVisitorsRouter;
