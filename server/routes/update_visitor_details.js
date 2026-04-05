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
    const siteId = req.siteId;
    if (!id) return res.status(400).json({ message: "Visitor ID required." });

    let dependentsArray = Array.isArray(additional_dependents)
      ? additional_dependents
      : additional_dependents
        ? JSON.parse(additional_dependents)
        : [];

    try {
      const verifySql = "SELECT id FROM visitors WHERE id = @visitorId";
      const verifyResult = await dbService.executeQuery(verifySql, [
        { name: "visitorId", type: sql.Int, value: id },
      ]);

      if (!verifyResult.recordset || verifyResult.recordset.length === 0) {
        return res.status(404).json({ message: "Visitor ID not found." });
      }

      // 2. USING OUTPUT INSERTED.id it include site_id
      const entry_time = new Date().toISOString();
      const visitsSql = `BEGIN TRANSACTION;
        BEGIN TRY
          INSERT INTO visits (
            visitor_id, site_id, entry_time, known_as, address, phone_number, unit, 
            reason_for_visit, type, company_name, mandatory_acknowledgment_taken
          ) 
          OUTPUT INSERTED.id AS newVisitId
          VALUES (
            @id, @siteId, @entryTime, @knownAs, @address, @phoneNumber, @unit, 
            @reasonForVisit, @type, @companyName, @mandatoryTaken
          );
          
          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          THROW;
        END CATCH
      `;
      const visitInputs = [
        { name: "id", type: sql.Int, value: id },
        { name: "siteId", type: sql.Int, value: siteId },
        { name: "entryTime", type: sql.DateTimeOffset, value: entry_time },
        { name: "knownAs", type: sql.NVarChar, value: known_as || null },
        { name: "address", type: sql.NVarChar, value: address || null },
        {
          name: "phoneNumber",
          type: sql.NVarChar,
          value: phone_number || null,
        },
        { name: "unit", type: sql.NVarChar, value: unit || null },
        {
          name: "reasonForVisit",
          type: sql.NVarChar,
          value: reason_for_visit || null,
        },
        { name: "type", type: sql.NVarChar, value: type || null },
        {
          name: "companyName",
          type: sql.NVarChar,
          value: company_name || null,
        },
        {
          name: "mandatoryTaken",
          type: sql.Bit,
          value: mandatory_acknowledgment_taken ? 1 : 0,
        },
      ];

      const visitResult = await dbService.executeQuery(visitsSql, visitInputs);
      const newVisitId = visitResult.recordset[0].newVisitId;

      // 4. Handle Dependents
      if (dependentsArray.length > 0) {
        for (const dependent of dependentsArray) {
          const depSql = `INSERT INTO dependents (full_name, age, visit_id) VALUES (@fullName, @age, @visitId)`;
          await dbService.executeQuery(depSql, [
            {
              name: "fullName",
              type: sql.NVarChar,
              value: dependent.full_name,
            },
            {
              name: "age",
              type: sql.Int,
              value: parseInt(dependent.age) || null,
            },
            { name: "visitId", type: sql.Int, value: newVisitId },
          ]);
        }
      }

      res.status(201).json({
        message: "Visitor Updated Successfully & signed in!",
        id: newVisitId,
      });
    } catch (err) {
      console.error("Transaction Error:", err.message);
      try {
      } catch (rbErr) {
        console.error("Rollback failed:", rbErr.message);
      }

      res.status(500).json({ error: "Update failed: " + err.message });
    }
  });
  return router;
}

module.exports = createUpdateVisitorRouter;
