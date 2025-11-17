const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

/**
 * Creates and configures a router for handling new visitor registrations.
 * @param {object} dbService - The Azure SQL database service instance (with executeQuery and sqlTypes).
 * @param {object} upload - The Multer instance for file uploads.
 * @returns {express.Router} - An Express router with the registration endpoint.
 */
function createRegistrationRouter(dbService, upload) {
  const router = express.Router();

  // Alias for the mssql type definitions
  const sql = dbService.sqlTypes;

  // Handle visitor registration - now async to use await with the dbService
  router.post("/register-visitor", upload.single("photo"), async (req, res) => {
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
      mandatory_acknowledgment_taken,
      additional_dependents,
    } = req.body;

    const photo_path = req.file
      ? `uploads/${path.basename(req.file.path)}`
      : null;

    let transaction; // Initialize transaction variable

    try {
      // --- 1. CHECK FOR DUPLICATE VISITOR (SELECT) ---
      const checkSql = `SELECT id FROM visitors WHERE first_name = @first_name AND last_name = @last_name`;
      const checkParams = [
        { name: "first_name", type: sql.NVarChar(255), value: first_name },
        { name: "last_name", type: sql.NVarChar(255), value: last_name },
      ];

      const existingVisitor = await dbService.executeQuery(
        checkSql,
        checkParams
      );

      // If a row is found, it means the visitor already exists.
      if (existingVisitor.length > 0) {
        const message = `A visitor named ${first_name} ${last_name} already exists. Please use the search bar to log them in.`;
        return res.status(409).json({ message });
      }

      // --- 2. START TRANSACTION ---

     const pool = dbService.getPool();
      if (!pool) throw new Error("Database connection pool is not initialized.");
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Create a request object tied to this specific transaction
      const request = new sql.Request(transaction);

      let visitorId;
      let visitId;

      // --- 3. INSERT INTO visitors TABLE ---
      const visitorSql = `
                INSERT INTO visitors (first_name, last_name, photo_path) 
                VALUES (@first_name, @last_name, @photo_path);
                SELECT @visitorId = SCOPE_IDENTITY();
            `;

      // Define parameters for the visitors table
      request.input("first_name", sql.NVarChar(255), first_name);
      request.input("last_name", sql.NVarChar(255), last_name);
      request.input("photo_path", sql.NVarChar(500), photo_path);

      // Define an output parameter to capture the ID
      request.output("visitorId", sql.Int);

      const visitorResult = await request.query(visitorSql);
      visitorId = visitorResult.output.visitorId;

      // Check if insertion failed (shouldn't happen with SCOPE_IDENTITY, but for safety)
      if (!visitorId) {
        throw new Error("Failed to retrieve new visitor ID.");
      }

      // --- 4. INSERT INTO visits TABLE ---
      const visitsSql = `
                INSERT INTO visits (
                    visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
                ) VALUES (
                    @visitor_id, @entry_time, @known_as, @address, @phone_number, @unit, @reason_for_visit, @type, @company_name, @mandatory_acknowledgment_taken
                );
                SELECT @visitId = SCOPE_IDENTITY();
            `;

      // Reset the request inputs and outputs for the visits query
      const visitRequest = new sql.Request(transaction);

      const entry_time = new Date().toISOString(); // Use JS ISO string format for DATETIMEOFFSET

      visitRequest.input("visitor_id", sql.Int, visitorId);
      visitRequest.input("entry_time", sql.DateTimeOffset, entry_time);
      visitRequest.input("known_as", sql.NVarChar(255), known_as);
      visitRequest.input("address", sql.NVarChar(500), address);
      visitRequest.input("phone_number", sql.NVarChar(50), phone_number);
      visitRequest.input("unit", sql.NVarChar(50), unit);
      visitRequest.input(
        "reason_for_visit",
        sql.NVarChar(500),
        reason_for_visit
      );
      visitRequest.input("type", sql.NVarChar(50), type);
      visitRequest.input("company_name", sql.NVarChar(255), company_name);
      visitRequest.input(
        "mandatory_acknowledgment_taken",
        sql.Bit,
        mandatory_acknowledgment_taken === "true" ||
          mandatory_acknowledgment_taken === true
          ? 1
          : 0
      );

      visitRequest.output("visitId", sql.Int);

      const visitResult = await visitRequest.query(visitsSql);
      visitId = visitResult.output.visitId;

      if (!visitId) {
        throw new Error("Failed to retrieve new visit ID.");
      }

      // --- 5. INSERT DEPENDENTS (IF ANY) ---
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
            // We must re-define the request parameters for each dependent,
            // as mssql reuses the request object for different queries in a transaction
            dependentRequest.input(
              "full_name",
              sql.NVarChar(255),
              dependent.full_name
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

      // Clean up uploaded file if registration failed
      if (req.file && req.file.path) {
        try {
          // Assuming fs module is available from your server.js context
          fs.unlinkSync(req.file.path);
          console.log(`Cleaned up uploaded file: ${req.file.path}`);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up uploaded file:",
            cleanupError.message
          );
        }
      }

      return res.status(500).json({
        error:
          "Visitor registration failed due to a database error or invalid data.",
        detail: error.message,
      });
    }
  });

  // Centralized error handler for the router. Catches errors from multer.
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred (e.g., file too large).
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // A custom error occurred
      return res.status(400).json({ error: err.message });
    }
    next();
  });

  return router;
}

module.exports = createRegistrationRouter;
