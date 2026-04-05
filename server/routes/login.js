/**
 * Creates and configures a router for handling visitor login.
 *
 * @param {object} dbService - The Azure SQL database service wrapper.
 * @returns {express.Router} - An Express router with the login endpoint.
 */
function createLoginRouter(dbService) {
  const router = require("express").Router();
  const sql = dbService.sqlTypes;
  // Endpoint for an existing visitor to log in
  router.post("/login", async (req, res) => {
    const { id } = req.body;
    const siteId = req.siteId; // get sit id from middleware
    const entry_time = new Date().toISOString();

    if (!id)
      return res.status(400).json({ message: "Visitor ID is required." });

    try {
      // 1. Find visitor status and last visit data on this building
      const findVisitorSql = `
                SELECT
                    v.id AS visitor_id,
                    v.is_banned,
                    -- Isolation: Check if they are already signed in at this specific building
                    (SELECT COUNT(*) FROM visits WHERE visitor_id = v.id AND exit_time IS NULL AND site_id = @siteId) AS active_visits,
                    (
                        SELECT TOP 1 
                            T2.known_as, 
                            T2.address, 
                            T2.phone_number, 
                            T2.unit, 
                            T2.reason_for_visit, 
                            T2.type, 
                            T2.company_name, 
                            T2.mandatory_acknowledgment_taken,
                            T2.id AS last_visit_id 
                        FROM visits AS T2
                        WHERE T2.visitor_id = v.id
                        ORDER BY T2.entry_time DESC
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    ) AS last_visit_data
                FROM visitors AS v
                WHERE v.id = @id;
            `;
      const visitorResult = await dbService.executeQuery(findVisitorSql, [
        { name: "id", type: dbService.sqlTypes.Int, value: id },
        { name: "siteId", type: sql.Int, value: siteId },
      ]);

      //  Check recordset
      if (!visitorResult.recordset || visitorResult.recordset.length === 0) {
        return res.status(404).json({ message: "Visitor ID not found." });
      }

      //  Access from recordset array
      const visitorRow = visitorResult.recordset[0];
      if (visitorRow.active_visits > 0) {
        return res.status(400).json({
          message:
            "Visitor is already signed in. Please sign out before signing in again.",
        });
      }
      if (visitorRow.is_banned) {
        return res
          .status(403)
          .json({ message: "This visitor is banned and cannot log in." });
      }

      let lastVisitDetails = visitorRow.last_visit_data
        ? JSON.parse(visitorRow.last_visit_data)
        : null;

      if (!lastVisitDetails) {
        return res.status(404).json({
          message: "No previous visit details exist. Please register again.",
        });
      }

      // 2. Fetch dependents using our standard executeQuery
      const lastVisitId = lastVisitDetails.last_visit_id;
      let dependentsData = [];
      if (lastVisitId) {
        const depResult = await dbService.executeQuery(
          `SELECT full_name, age FROM dependents WHERE visit_id = @lastVisitId`,
          [
            {
              name: "lastVisitId",
              type: dbService.sqlTypes.Int,
              value: lastVisitId,
            },
          ],
        );
        dependentsData = depResult.recordset; // This is now an array of dependents
      }

      // 3. Insert New Visit and Dependents in a SINGLE BATCH with site_id
      const loginBatchSql = `
        BEGIN TRANSACTION;
        BEGIN TRY
          -- Insert Visit with Site ID
          INSERT INTO visits (visitor_id, site_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken)
          OUTPUT INSERTED.id AS newVisitId
          VALUES (@visitor_id, @site_id, @entry_time, @known_as, @address, @phone_number, @unit, @reason_for_visit, @type, @company_name, @mandatoryTaken);
          
          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          THROW;
        END CATCH
      `;

      const loginInputs = [
        { name: "visitor_id", type: dbService.sqlTypes.Int, value: id },

        { name: "site_id", type: sql.Int, value: siteId },
        {
          name: "entry_time",
          type: dbService.sqlTypes.DateTimeOffset,
          value: entry_time,
        },
        {
          name: "known_as",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.known_as || null,
        },
        {
          name: "address",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.address || null,
        },
        {
          name: "phone_number",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.phone_number || null,
        },
        {
          name: "unit",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.unit || null,
        },
        {
          name: "reason_for_visit",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.reason_for_visit || null,
        },
        {
          name: "type",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.type || null,
        },
        {
          name: "company_name",
          type: dbService.sqlTypes.NVarChar,
          value: lastVisitDetails.company_name || null,
        },
        {
          name: "mandatoryTaken",
          type: sql.Bit,
          value: lastVisitDetails.mandatory_acknowledgment_taken ? 1 : 0,
        },
      ];

      const loginResult = await dbService.executeQuery(
        loginBatchSql,
        loginInputs,
      );
      const newVisitId = loginResult.recordset[0].newVisitId;

      // 4. Re-insert dependents for the new visit
      if (dependentsData.length > 0) {
        for (const dep of dependentsData) {
          await dbService.executeQuery(
            `INSERT INTO dependents (visit_id, full_name, age) VALUES (@vId, @name, @age)`,
            [
              { name: "vId", type: dbService.sqlTypes.Int, value: newVisitId },
              {
                name: "name",
                type: dbService.sqlTypes.NVarChar,
                value: dep.full_name,
              },
              { name: "age", type: dbService.sqlTypes.Int, value: dep.age },
            ],
          );
        }
      }

      return res.status(200).json({
        message: "Visitor signed in successfully!",
        visitorData: { ...lastVisitDetails, id, dependents: dependentsData },
      });
    } catch (err) {
      console.error(" Login Error:", err.message);
      return res.status(500).json({ error: "Sign-in failed: " + err.message });
    }
  });

  return router;
}

module.exports = createLoginRouter;
