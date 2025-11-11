                                    # ☁️ Visitor Tracking Backend Server - Azure SQL Version

This directory contains the Node.js/Express backend API for the Visitor Tracking and Management System. It is responsible for handling all persistent data storage via Azure SQL Database, processing administrative actions, and serving visitor data to the frontend client.

---

## ⚙️ Dependencies and Setup

### Installation

Ensure you are in the `/server` directory.

Install required Node.js packages (including the necessary Azure SQL driver and Identity library):

```bash
npm install
npm install @azure/identity
Environment Variables
The server relies on environment variables for configuration and security. These variables must be configured as Application Settings in the Azure Portal when deployed to Azure Static Web Apps.

Define the following variables in your local .env file (for local testing):

PORT: The port on which the Express server will run (e.g., 3001).

CLIENT_URL: The URL of the frontend client (required for CORS, e.g., http://localhost:5173).

DB_SERVER: Azure SQL Server Fully Qualified Domain Name (FQDN) (e.g., <servername>.database.windows.net).

DB_NAME: The name of your Azure SQL Database.

MASTER_PASSWORD: The secret password for sensitive administrative actions ( UNBAN).

MASTER_PASSWORD2: The secret password for accessing the data history and administrative UI.


💾 Database (Managed Identity)
This application connects to a cloud-hosted Azure SQL Database using the System-Assigned Managed Identity of the hosting Azure Static Web App.

Connection Prerequisite:

The Static Web App's System-Assigned Managed Identity must be enabled in the Azure Portal.

The Managed Identity's name  must be granted access to the database via the T-SQL command: CREATE USER [......] FROM EXTERNAL PROVIDER;

The identity must be assigned appropriate roles (db_datareader, db_datawriter).

The Node.js backend uses the @azure/identity library and token-based authentication for a secure, passwordless connection.

Database Schema Overview (Azure SQL)
The core data is managed across four tables:

Table: visitors (Visitor Master Data)

visitor_id: INT (PRIMARY KEY) - Unique ID.

first_name, last_name: NVARCHAR - Visitor's name.

photo_path: NVARCHAR - Path to the uploaded photo.

is_banned: INT (DEFAULT 0) - Ban status.

Table: visits (Sign-In/Sign-Out Logs)

visit_id: INT (PRIMARY KEY) - Unique ID.

visitor_id: INT (FOREIGN KEY) - Links to the visitors table.

entry_time: DATETIME2 (NOT NULL) - Timestamp of sign-in.

exit_time: DATETIME2 - Timestamp of sign-out (NULL if currently on-site).

Table: dependents (Guest Dependent Details)

dependent_id: INT (PRIMARY KEY) - Unique ID.

visitor_id: INT (FOREIGN KEY) - Links to the primary visitor.

full_name, age: Details of the dependent.

Table: audit_logs (Internal Actions Record)

Stores records of internal administrative and maintenance actions, including event_name, timestamp, and status.

🌐 API Endpoints
All endpoints are prefixed with /api.

POST /api/register: Registers a new visitor and logs their initial sign-in.

GET /api/visitors: Retrieves a list of all visitors currently signed in.

GET /api/visitors/:id: Retrieves detailed information about a specific visitor.

PUT /api/update/:id: Updates a visitor's details.

POST /api/signout/:id: Logs the visitor out by setting the exit_time.

POST /api/ban/:id: Bans a visitor by setting is_banned = 1 (Requires MASTER_PASSWORD).

POST /api/unban/:id: Unbans a visitor by setting is_banned = 0 (Requires MASTER_PASSWORD).

POST /api/authorize-history: Authorizes access to the history endpoints (Requires MASTER_PASSWORD2).

GET /api/history: Retrieves all historical visits with optional filtering.

GET /api/export-history/:id: Exports the full visit history for a visitor as a CSV file.

🧪 Testing
Testing is implemented using Node.js's built-in testing utilities.

To run all tests:

Bash

npm test