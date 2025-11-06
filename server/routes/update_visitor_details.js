const express = require("express");
const sql = require("mssql");

/**
 * Creates and configures a router for handling visitor data updates for a returning visitor
 * using Azure SQL and explicit transactions.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the update endpoint.
 */
function createUpdateVisitorRouter(dbService) {
  const router = express.Router();

  // Endpoint to handle visitor data updates (new visit) for a returning visitor
  router.post("/update-visitor-details", async (req, res) => {
    const {
      id,
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

    if (!id) {
      return res.status(400).json({
        message: "Visitor ID is required for re-registration.",
      });
    }

    // Attempt to parse dependents immediately
    let dependentsArray = [];
    if (additional_dependents) {
      try {
        dependentsArray = JSON.parse(additional_dependents);
      } catch (parseError) {
        console.error("Failed to parse dependents JSON. Using fallback:", parseError.message);
        // Fallback for non-JSON dependent string (preserving original logic)
        dependentsArray = [
          { full_name: additional_dependents, age: null },
        ];
      }
    }

    let newVisitId = null;

    try {
      // 1. Begin Transaction
      await dbService.executeQuery("BEGIN TRAN;");

      // 2. Verify the visitor ID exists in the system
      const verifySql = "SELECT id FROM visitors WHERE id = @visitorId";
      const verifyInputs = [{ name: "visitorId", type: sql.Int, value: id }];
      const visitorCheck = await dbService.executeQuery(verifySql, verifyInputs);

      if (visitorCheck.recordset.length === 0) {
        await dbService.executeQuery("ROLLBACK TRAN;");
        return res.status(404).json({ message: "Visitor ID not found." });
      }

      // 3. Insert a new visit record and retrieve the new ID using SCOPE_IDENTITY()
      const entry_time = new Date().toISOString();
      const visitsSql = `
        INSERT INTO visits (
          visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
        ) VALUES (
          @id, @entryTime, @knownAs, @address, @phoneNumber, @unit, @reasonForVisit, @type, @companyName, @mandatoryTaken
        );
        SELECT SCOPE_IDENTITY() AS newVisitId; -- Retrieve the newly created ID
      `;

      const visitInputs = [
        { name: "id", type: sql.Int, value: id },
        { name: "entryTime", type: sql.NVarChar, value: entry_time },
        { name: "knownAs", type: sql.NVarChar, value: known_as || null },
        { name: "address", type: sql.NVarChar, value: address || null },
        { name: "phoneNumber", type: sql.NVarChar, value: phone_number || null },
        { name: "unit", type: sql.NVarChar, value: unit || null },
        { name: "reasonForVisit", type: sql.NVarChar, value: reason_for_visit || null },
        { name: "type", type: sql.NVarChar, value: type || null },
        { name: "companyName", type: sql.NVarChar, value: company_name || null },
        { name: "mandatoryTaken", type: sql.NVarChar, value: mandatory_acknowledgment_taken || null },
      ];

      const visitResult = await dbService.executeQuery(visitsSql, visitInputs);
      newVisitId = visitResult.recordset[0].newVisitId; // Extract the new ID

      // 4. Handle and insert dependents
      if (dependentsArray.length > 0) {
        const dependentPromises = dependentsArray.map(async (dependent) => {
          const depSql = `
            INSERT INTO dependents (full_name, age, visit_id) 
            VALUES (@fullName, @age, @visitId)
          `;
          const depInputs = [
            { name: "fullName", type: sql.NVarChar, value: dependent.full_name },
            { name: "age", type: sql.Int, value: dependent.age || null },
            { name: "visitId", type: sql.Int, value: newVisitId },
          ];
          await dbService.executeQuery(depSql, depInputs);
        });

        // Wait for all dependent inserts to complete
        await Promise.all(dependentPromises);
      }

      // 5. Commit Transaction on success
      await dbService.executeQuery("COMMIT TRAN;");

      res.status(201).json({
        message: "Visitor Updated Successfully & signed in!",
        id: newVisitId,
      });

    } catch (err) {
      // 6. Rollback Transaction on error
      console.error("Transaction Error in /update-visitor-details:", err.message);
      // Attempt to rollback, ignoring any error that might occur during rollback itself
      try {
        await dbService.executeQuery("ROLLBACK TRAN;");
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr.message);
      }
      return res.status(500).json({ error: "Transaction failed: " + err.message });
    }
  });

  return router;
}

module.exports = createUpdateVisitorRouter;
