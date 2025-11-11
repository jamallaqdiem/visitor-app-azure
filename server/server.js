require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const dbService = require("./azureSqlService");

const app = express();
const PORT = process.env.PORT || 3001; 

// Import Routers ]
const runDataComplianceCleanup = require("./routes/clean_data");
const createRegistrationRouter = require("./auth/registration");
const createVisitorsRouter = require("./routes/visitors");
const createLoginRouter = require("./routes/login");
const createUpdateVisitorRouter = require("./routes/update_visitor_details");
const createLogoutRouter = require("./routes/logout");
const createBanVisitorRouter = require("./routes/ban");
const createUnbanVisitorRouter = require("./routes/unban");
const createSearchVisitorsRouter = require("./routes/search_visitors");
const createMissedVisitRouter = require("./routes/record_missed_visit");
const createHistoryRouter = require("./routes/display_history"); 

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20Mb size limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/gif"
    ) {
      cb(null, true); // accept
    } else {
      cb(
        new Error("Invalid file type, only JPEG, PNG, or GIF is allowed!"),
        false
      ); // reject
    }
  },
});

/**
 * Main application initializer function.
 * Connects to the database and then starts the server.
 */
async function initializeApp() {
    try {
        // 1. Connect to the Azure SQL Database Pool
        await dbService.connectDb();

        // 2. Router usage 
        app.use("/api", createRegistrationRouter(dbService, upload));
        app.use("/api", createVisitorsRouter(dbService));
        app.use("/api", createLoginRouter(dbService));
        app.use("/api", createUpdateVisitorRouter(dbService));
        app.use("/api", createLogoutRouter(dbService));
        app.use("/api", createBanVisitorRouter(dbService));
        app.use("/api", createUnbanVisitorRouter(dbService));
        app.use("/api", createSearchVisitorsRouter(dbService)); 
        app.use("/api", createMissedVisitRouter(dbService)); 
        app.use("/api", createHistoryRouter(dbService));

        // 3. Running compliance cleanup job 
        runDataComplianceCleanup(dbService);
        
        // 4. Start the Express Server
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });

    } catch (error) {
        // If connectDb() fails, the server will not start.
        console.error('Server failed to start due to database connection error. Exiting.', error);
        process.exit(1);
    }
}

// Execute the initialization function
initializeApp();
