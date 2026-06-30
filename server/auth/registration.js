const express = require("express");
const path = require("path");
const { BlobServiceClient } = require("@azure/storage-blob");
/**
 * Creates and configures a router for handling new visitor registrations.
 * @param {object} dbService - The Azure SQL database service instance (with executeQuery and sqlTypes).
 * @param {object} upload - The Multer instance for file uploads.
 * @returns {express.Router} - An Express router with the registration endpoint.
 */

// Initialize Azure Blob Service
const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "visitor-photos"; // The container name in azure

if (!AZURE_STORAGE_CONNECTION_STRING) {
  console.error("Azure Storage Connection String is missing!");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING,
);
const containerClient = blobServiceClient.getContainerClient(containerName);

function createRegistrationRouter(dbService, upload) {
  const router = express.Router();

  // Alias for the mssql type definitions
  const sql = dbService.sqlTypes;

  // Handle visitor registration - now async to use await with the dbService
  router.post("/register-visitor", upload.single("photo"), async (req, res) => {
    const siteId = req.siteId;
    const {
      first_name,
      last_name,
      known_as,
      address,
      phone_number,
      unit,
      reason_for_visit,
      type,
      company_name,
      additional_dependents,
    } = req.body;

    let photo_path = null;
    let blobName = null;

    if (req.file) {
      try {
        // Create a unique name for the image in the cloud
        blobName = `visitor-${Date.now()}${path.extname(req.file.originalname)}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // WE send the buffer the image in RAM to Azure
        await blockBlobClient.uploadData(req.file.buffer, {
          blobHTTPHeaders: { blobContentType: req.file.mimetype },
        });

        // This is the full URL to save in the SQL Database
        photo_path = blockBlobClient.url;
        console.log(" Photo uploaded to Azure:", photo_path);
      } catch (uploadErr) {
        console.error("Azure Upload Error:", uploadErr.message);
        return res
          .status(500)
          .json({ error: "Failed to upload photo to cloud." });
      }
    }

    let transaction; // Initialize transaction variable

    try {
      // --- 1. CHECK FOR DUPLICATE VISITOR (SELECT) ---
      const checkSql = `SELECT id FROM visitors WHERE first_name = @first_name AND last_name = @last_name AND photo_path = @photo_path`;
      const checkParams = [
        { name: "first_name", type: sql.NVarChar(255), value: first_name },
        { name: "last_name", type: sql.NVarChar(255), value: last_name },
        { name: "photo_path", type: sql.NVarChar(2048), value: photo_path },
      ];

      const results = await dbService.executeQuery(checkSql, checkParams);
      const existingVisitor = results.recordset || [];

      // If a row is found, it means the visitor already exists.
      if (existingVisitor.length > 0) {
        if (photo_path && blobName) {
          await containerClient.getBlockBlobClient(blobName).deleteIfExists();
        }
        const message = `A visitor named ${first_name} ${last_name} already exists. Please use the search bar to log them in.`;
        return res.status(409).json({ message });
      }

      // --- 2. START TRANSACTION ---
      //  We get the pool from the dbService and start a transaction manually
      const pool = await dbService.connectDb();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Create a request object tied to this specific transaction
      const request = new sql.Request(transaction);

      let visitorId;
      let visitId;

      // --- 3. INSERT INTO visitors TABLE ---
      const visitorSql = `
                INSERT INTO visitors (first_name, last_name, photo_path, site_id) 
                VALUES (@first_name, @last_name, @photo_path, @site_id);
                SELECT @visitorId = SCOPE_IDENTITY();
            `;

      // Define parameters for the visitors table
      request.input("first_name", sql.NVarChar(255), first_name);
      request.input("last_name", sql.NVarChar(255), last_name);
      request.input("photo_path", sql.NVarChar(500), photo_path);
      request.input("site_id", sql.Int, siteId);

      // Define an output parameter to capture the ID
      request.output("visitorId", sql.Int);

      const visitorResult = await request.query(visitorSql);
      visitorId = visitorResult.output.visitorId;

      // Check if insertion failed, I used SCOPE_IDENTITY, should be safe
      if (!visitorId) {
        throw new Error("Failed to retrieve new visitor ID.");
      }

      // --- 4. INSERT INTO visits TABLE ---
      const visitsSql = `
                INSERT INTO visits (
                    visitor_id, site_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
                ) VALUES (
                    @visitor_id, @site_id, @entry_time, @known_as, @address, @phone_number, @unit, @reason_for_visit, @type, @company_name, @mandatory_acknowledgment_taken
                );
                SELECT @visitId = SCOPE_IDENTITY();
            `;
      // Reset the request inputs and outputs for the visits query
      const visitRequest = new sql.Request(transaction);

      const entry_time = new Date().toISOString(); // Use JS ISO string format for DATETIMEOFFSET

      visitRequest.input("visitor_id", sql.Int, visitorId);
      visitRequest.input("site_id", sql.Int, siteId);
      visitRequest.input("entry_time", sql.DateTimeOffset, entry_time);
      visitRequest.input("known_as", sql.NVarChar(255), known_as);
      visitRequest.input("address", sql.NVarChar(500), address);
      visitRequest.input("phone_number", sql.NVarChar(50), phone_number);
      visitRequest.input("unit", sql.NVarChar(50), unit);
      visitRequest.input(
        "reason_for_visit",
        sql.NVarChar(500),
        reason_for_visit,
      );
      visitRequest.input("type", sql.NVarChar(50), type);
      visitRequest.input("company_name", sql.NVarChar(255), company_name);
      const rawValue = req.body.mandatory_acknowledgment_taken;
      const bitValue =
        rawValue === true ||
        rawValue === 1 ||
        String(rawValue).toLowerCase() === "true" ||
        String(rawValue).toLowerCase() === "on" ||
        String(rawValue).toLowerCase() === "1"
          ? 1
          : 0;
      visitRequest.input("mandatory_acknowledgment_taken", sql.Bit, bitValue);

      visitRequest.output("visitId", sql.Int);

      const visitResult = await visitRequest.query(visitsSql);
      visitId = visitResult.output.visitId;

      if (!visitId) {
        throw new Error("Failed to retrieve new visit ID.");
      }

      // --- 5. INSERT DEPENDENTS  ---
      if (additional_dependents) {
        let dependentsArray = [];
        try {
          dependentsArray = JSON.parse(additional_dependents);
        } catch (parseError) {
          throw new Error("Invalid dependents JSON format."); // Rollback handled below
        }

        if (dependentsArray.length > 0) {
          // Create a separate request for batch dependent insertion
          const dependentRequest = new sql.Request(transaction);

          const dependentSql = `
                        INSERT INTO dependents (full_name, age, visit_id) 
                        VALUES (@full_name, @age, @visit_id)
                    `;

          for (const dependent of dependentsArray) {
            dependentRequest.input(
              "full_name",
              sql.NVarChar(255),
              dependent.full_name,
            );
            dependentRequest.input("age", sql.Int, dependent.age);
            dependentRequest.input("visit_id", sql.Int, visitId);

            // Execute the single dependent insert
            await dependentRequest.query(dependentSql);

            // Clear inputs for the next iteration to prevent using wrong values
            dependentRequest.inputs = [];
          }
        }
      }

      // --- 6. COMMIT TRANSACTION ---
      await transaction.commit();

      res.status(201).json({
        message: "Visitor registered successfully!",
        id: visitorId,
        visitId: visitId,
      });
    } catch (error) {
      console.error("Registration Transaction Failed:", error.message);

      // --- 7. ROLLBACK ON ANY FAILURE ---
      if (transaction) {
        try {
          await transaction.rollback();
          console.log("Transaction successfully rolled back.");
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError.message);
        }
      }
      if (photo_path && blobName) {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
        console.log(" Cleaned up orphan blob after failed transaction.");
      }

      return res.status(500).json({
        error:
          "Visitor registration failed due to a database error or invalid data.",
        detail: error.message,
      });
    }
  });

  return router;
}

module.exports = createRegistrationRouter;
