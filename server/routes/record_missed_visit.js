const express = require("express");
const sql = require("mssql");

/**
 * Creates and configures a router for handling historical visit corrections
 * using Azure SQL.
 *
 * @param {object} dbService - The Azure SQL database service wrapper (e.g., with executeQuery).
 * @returns {express.Router} - An Express router with the correction endpoint.
 */
function createMissedVisitRouter(dbService) {
    const router = express.Router();

    // Endpoint: POST /record-missed-visit
    router.post("/record-missed-visit", async (req, res) => {
        // 1. Extract and validate data
        const { visitorId, pastEntryTime } = req.body;
        if (!visitorId || !pastEntryTime) {
            return res.status(400).json({ message: "Missing visitor ID or required entry time." });
        }

        // 2. Setting the Exit Time and validate entry time logic
        const exitDate = new Date(Date.now()); 
        const currentExitTime = exitDate.toISOString(); 
        const entryDate = new Date(pastEntryTime); 

        // Checking if the date is valid and if the entry time occurs strictly before the current exit time.
        // We use getTime() for reliable millisecond comparison
        if (isNaN(entryDate.getTime()) || entryDate.getTime() >= exitDate.getTime()) {
            console.error("Attempted to record invalid or future entry time:", pastEntryTime);
            return res.status(400).json({
                message: "Invalid entry time. It must be a valid date/time and occur before the current exit time."
            });
        }
        // Format the user provided date.
        const entry_time_iso = entryDate.toISOString();

        try {
            // 3. Step 1: Finding the details of the visitor's most recent visit.
            const selectSql = `
                SELECT TOP 1
                    known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
                FROM visits
                WHERE visitor_id = @visitorId
                ORDER BY entry_time DESC
            `;

            const selectInputs = [
                { name: "visitorId", type: sql.Int, value: visitorId }
            ];

            const result = await dbService.executeQuery(selectSql, selectInputs);

            // Azure SQL result.recordset contains the rows
            const lastVisit = result.recordset[0];

            // Using details from the last visit, or fall back to defaults if no previous record exists
            const visitDetails = lastVisit || {};
            const knownAs = visitDetails.known_as || '--';
            const address1 = visitDetails.address || '--';
            const phoneNumber = visitDetails.phone_number || null;
            const unit = visitDetails.unit || "--";
            const reasonForVisit = visitDetails.reason_for_visit || null;
            const type = visitDetails.type || "Visitor";
            const companyName = visitDetails.company_name || null;
            const mandatoryTaken = visitDetails.mandatory_acknowledgment_taken || '--'

            // 4. Step 2: Insert the new historical record
            const insertSql = `
                INSERT INTO visits (
                    visitor_id, entry_time, exit_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
                )
                VALUES (@visitorId, @entryTime, @exitTime, @knownAs, @address, @phoneNumber, @unit, @reasonForVisit, @type, @companyName, @mandatoryTaken)
            `;

            const insertInputs = [
                { name: "visitorId", type: sql.Int, value: visitorId },
                { name: "entryTime", type: sql.NVarChar, value: entry_time_iso },
                { name: "exitTime", type: sql.NVarChar, value: currentExitTime },
                { name: "knownAs", type: sql.NVarChar, value: knownAs },
                { name: "address", type: sql.NVarChar, value: address1 },
                { name: "phoneNumber", type: sql.NVarChar, value: phoneNumber },
                { name: "unit", type: sql.NVarChar, value: unit },
                { name: "reasonForVisit", type: sql.NVarChar, value: reasonForVisit },
                { name: "type", type: sql.NVarChar, value: type },
                { name: "companyName", type: sql.NVarChar, value: companyName },
                { name: "mandatoryTaken", type: sql.NVarChar, value: mandatoryTaken }
            ];

            await dbService.executeQuery(insertSql, insertInputs);

            // Success response (Fixed typo to match user's test expectation: 'Sing it Out')
            res.status(200).json({
                message: "Visitor Entry Time Corrected & Signed Out",
                entry: entry_time_iso,
                exit: currentExitTime
            });

        } catch (err) {
            // Log and return 500 status on database failure
            console.error("Azure SQL Error in /record-missed-visit:", err.message);
            return res.status(500).json({ error: "Failed to record historical visit due to database error: " + err.message });
        }
    });

    return router;
}

module.exports = createMissedVisitRouter;
