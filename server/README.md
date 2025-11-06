
                                        ☁️ Visitor Tracking Backend Server - Azure SQL Version

This directory contains the Node.js/Express backend API for the Visitor Tracking and Management System. It is responsible for handling all persistent data storage via Azure SQL Database, processing administrative actions, and serving visitor data to the frontend client.

⚙️ Dependencies and Setup
Installation
Ensure you are in the /server directory.

Install required Node.js packages (including the necessary Azure SQL driver):

Bash

npm install
Environment Variables
The server relies on environment variables for configuration and security. Create a file named .env in this directory and define the following variables, which are required for the server to run:

PORT: The port on which the Express server will run (e.g., 3001).

CLIENT_URL: The URL of the frontend client (required for CORS, e.g., http://localhost:5173).

DB_SERVER: Azure SQL Server FQDN (e.g., <servername>.database.windows.net).

DB_NAME: The name of your Azure SQL Database.

DB_USER: SQL Login Username for the database.

DB_PASSWORD: SQL Login Password for the database.

MASTER_PASSWORD: The secret password for sensitive actions (e.g., BAN, UNBAN).

MASTER_PASSWORD2: The secret password for accessing the data history.

⚠️ SECURITY NOTE: Database connection variables (DB_SERVER, etc.) and passwords must be kept secret and must NOT be committed to GitHub.

Database
This application connects to a cloud-hosted Azure SQL Database.

The connection details are configured via the environment variables defined in the .env file.

The server.js file handles the initial connection and table creation if the database schema is not found.

💾 Database Schema Overview (Azure SQL)
The core data is managed across three main tables, hosted in Azure SQL:

Table: visitors (Visitor Master Data)

visitor_id: INT (PRIMARY KEY) - Unique ID for the visitor.

first_name: NVARCHAR (NOT NULL) - Visitor's first name.

last_name: NVARCHAR (NOT NULL) - Visitor's last name.

photo_path: NVARCHAR - File path to the uploaded photo.

is_banned: INT (DEFAULT 0) - Ban status (1 for banned, 0 for active).

created_at: DATETIME2 (DEFAULT CURRENT_TIMESTAMP) - Record creation timestamp.

Table: visits (Sign-In/Sign-Out Logs)

visit_id: INT (PRIMARY KEY) - Unique ID for the visit log.

visitor_id: INT (FOREIGN KEY) - Links to the visitors table.

unit: NVARCHAR - The unit/apt number visited.

phone_number: NVARCHAR - Contact number.

type: NVARCHAR (NOT NULL) - The visitor category.

company_name: NVARCHAR - Company name (if professional/contractor).

reason_for_visit: NVARCHAR - Purpose of the visit.

entry_time: DATETIME2 (NOT NULL) - Timestamp of sign-in.

exit_time: DATETIME2 - Timestamp of sign-out (NULL if currently on-site).

notes: NVARCHAR - General notes.

Table: dependents (Guest Dependent Details)

dependent_id: INT (PRIMARY KEY) - Unique ID.

visitor_id: INT (FOREIGN KEY) - Links to the primary visitor (guest).

full_name: NVARCHAR (NOT NULL) - Full name of the dependent.

age: INT - Age of the dependent.

4. Table: audit_logs (Internal Actions Record)

Stores records of internal administrative and maintenance actions.

id: INT (PRIMARY KEY) - Unique ID for the audit log entry.

event_name: NVARCHAR (NOT NULL) - Name of the action (e.g., 'Data Purge', 'Admin Login').

timestamp: DATETIMEOFFSET - Time the event occurred.

status: NVARCHAR (NOT NULL) - Status of the action (e.g., 'Success', 'Failed').

profiles_deleted: INT - Count of profiles deleted (if applicable).

visits_deleted: INT - Count of visits deleted (if applicable).

dependents_deleted: INT - Count of dependents deleted (if applicable)

🌐 API Endpoints
All endpoints are prefixed with /api.

POST /api/register

Description: Registers a new visitor and logs their initial sign-in.

Body: FormData including visitor details, a photo file, and a JSON string for additional_dependents.

GET /api/visitors

Description: Retrieves a list of all visitors currently signed in (where exit_time is NULL).

GET /api/visitors/:id

Description: Retrieves detailed information about a specific visitor by ID.

PUT /api/update/:id

Description: Updates a visitor's details (e.g., contact info, company name, unit).

Body: JSON object with fields like {firstName, lastName, phoneNumber, unit, reasonForVisit}.

POST /api/signout/:id

Description: Logs the visitor out by setting the exit_time for their active visit.

POST /api/ban/:id

Description: Bans a visitor by setting is_banned = 1.

Body: JSON object containing { admin_password: '...' }.

POST /api/unban/:id

Description: Unbans a visitor by setting is_banned = 0.

Body: JSON object containing { admin_password: '...' }.

GET /api/export-history/:id

Description: Exports the full visit history for a visitor as a CSV file.

🧪 Testing
Testing is implemented using Node.js's built-in testing utilities (or Jest/Mocha if configured).

Test files are located alongside their respective route files (e.g., registration.test.js tests registration.js).

To run all tests:

Bash

npm test