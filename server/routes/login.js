/**
 * Creates and configures a router for handling visitor login.
 *
 * @param {object} dbService - The Azure SQL database service wrapper.
 * @returns {express.Router} - An Express router with the login endpoint.
 */
function createLoginRouter(dbService) {
  const router = require("express").Router();

  // Endpoint for an existing visitor to log in 
  router.post("/login", async (req, res) => {
    const { id } = req.body;
    const entry_time = new Date().toISOString();

    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required." });
    }

    let transaction;
    let lastVisitDetails = {};
    let dependentsData = [];

    try {

      // 1. Find the visitor's ban status and the details of their last visit.
      const findVisitorSql = `
                SELECT
                    v.id AS visitor_id,
                    v.is_banned,
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
      ]);

      if (!visitorResult || visitorResult.length === 0) {
        return res.status(404).json({ message: "Visitor not found." });
      }

      const visitorRow = visitorResult[0];

      if (visitorRow.is_banned === true) {
        return res
          .status(403)
          .json({ message: "This visitor is banned and cannot log in." });
      }

      // Parse the last visit data
      if (visitorRow.last_visit_data) {
        try {
          lastVisitDetails = JSON.parse(visitorRow.last_visit_data);
        } catch (parseErr) {
          console.error(
            "Failed to parse last_visit_data JSON:",
            parseErr.message
          );
        }
      } else {
        return res.status(404).json({
          message:
            "Visitor found but no previous visit details exist. Please register again.",
        });
      }

      // 2. Fetch dependents associated with the last successful visit
      const lastVisitId = lastVisitDetails.last_visit_id;
      if (lastVisitId) {
        const findDependentsSql = `
                    SELECT full_name, age 
                    FROM dependents 
                    WHERE visit_id = @lastVisitId;
                `;
        dependentsData = await dbService.executeQuery(findDependentsSql, [
          {
            name: "lastVisitId",
            type: dbService.sqlTypes.Int,
            value: lastVisitId,
          },
        ]);
      }

      // --- Step 3: Start Transaction to insert new visit and dependents ---
      const pool = dbService.getPool();
      if (!pool) throw new Error("Database connection pool is not initialized.");
      transaction = new dbService.sqlTypes.Transaction(pool);
      await transaction.begin();

      const request = new dbService.sqlTypes.Request(transaction);

      // 4. Insert New Visit (Uses OUTPUT INSERTED.id to get the new visit ID)
      const insertVisitSql = `
                INSERT INTO visits (visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken)
                OUTPUT INSERTED.id
                VALUES (@visitor_id, @entry_time, @known_as, @address, @phone_number, @unit, @reason_for_visit, @type, @company_name, @mandatory_acknowledgment_taken);
            `;

      request.input("visitor_id", dbService.sqlTypes.Int, id);
      request.input("entry_time", dbService.sqlTypes.DateTime, entry_time);
      request.input(
        "known_as",
        dbService.sqlTypes.NVarChar(255),
        lastVisitDetails.known_as || null
      );
      request.input(
        "address",
        dbService.sqlTypes.NVarChar(255),
        lastVisitDetails.address || null
      );
      request.input(
        "phone_number",
        dbService.sqlTypes.NVarChar(50),
        lastVisitDetails.phone_number || null
      );
      request.input(
        "unit",
        dbService.sqlTypes.NVarChar(50),
        lastVisitDetails.unit || null
      );
      request.input(
        "reason_for_visit",
        dbService.sqlTypes.NVarChar(255),
        lastVisitDetails.reason_for_visit || null
      );
      request.input(
        "type",
        dbService.sqlTypes.NVarChar(50),
        lastVisitDetails.type || null
      );
      request.input(
        "company_name",
        dbService.sqlTypes.NVarChar(255),
        lastVisitDetails.company_name || null
      );
      request.input(
        "mandatory_acknowledgment_taken",
        dbService.sqlTypes.Bit,
        lastVisitDetails.mandatory_acknowledgment_taken || false
      );

      const visitInsertResult = await request.query(insertVisitSql);
      const newVisitId = visitInsertResult.recordset[0].id;

      // 5. Insert Dependents (if any were found from the last visit)
      if (dependentsData.length > 0) {
        const dependentInsertSql = `
                    INSERT INTO dependents (visit_id, full_name, age)
                    VALUES (@visit_id, @full_name, @age);
                `;

        for (const dep of dependentsData) {
          const dependentRequest = new dbService.sqlTypes.Request(transaction);
          dependentRequest.input(
            "visit_id",
            dbService.sqlTypes.Int,
            newVisitId
          );
          dependentRequest.input(
            "full_name",
            dbService.sqlTypes.NVarChar(255),
            dep.full_name
          );
          dependentRequest.input("age", dbService.sqlTypes.Int, dep.age);
          await dependentRequest.query(dependentInsertSql);
        }
      }

      // 6. Commit Transaction
      await transaction.commit();

      // Prepare response data
      const visitorData = {
        id: id,
        is_banned: visitorRow.is_banned,
        dependents: dependentsData,
        ...lastVisitDetails,
      };
      delete visitorData.last_visit_id; // Clean up the temporay ID

      return res.status(200).json({
        message: "Visitor signed in successfully!",
        visitorData: visitorData,
      });
    } catch (err) {
      console.error("Error during visitor login (check-in):", err);
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackErr) {
          console.error("Transaction rollback failed:", rollbackErr);
        }
      }
      return res.status(500).json({
        error: "An unexpected database error occurred during sign-in.",
      });
    } 
  });

  return router;
}

module.exports = createLoginRouter;
