const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const dbService = require("./azureSqlService"); 

const app = express();

// Import Routers 
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

// Handle file uploads directory
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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


dbService.connectDb()
    .then(() => {
        console.log("Database connection pool initialized.");
    })
    .catch(error => {
        console.error('Initial database connection failed. Endpoints may fail.', error);
    });

// Router usage 
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

// Running compliance cleanup job 
runDataComplianceCleanup(dbService);

module.exports = app;