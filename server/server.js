require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
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

const siteHandler = (req, res, next) => {
  // 1. Look into the headers for 'x-site-id'
  const siteId = req.headers["x-site-id"];

  // 2. Validate: If it's missing, stop the request
  if (!siteId) {
    console.error("Security Alert: Request blocked. Missing x-site-id header.");
    return res.status(400).json({
      error: "Building Identification Required. Access Denied.",
    });
  }

  // 3. Attach it to the 'req' object so routes can see it later
  req.siteId = parseInt(siteId, 10);

  // 4. This tells Express to move to the next function/router
  next();
};

// Keep the file in the RAM
const storage = multer.memoryStorage();

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
        false,
      ); // reject
    }
  },
});

dbService
  .connectDb()
  .then(() => {
    console.log("Database connection pool initialized.");
    console.log("--- Starting Data Retention Compliance Cleanup Job ---");
    runDataComplianceCleanup(dbService);
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Backend Server is LIVE on port ${PORT}`);
      console.log("Ready for frontend requests...");
    });
  })
  .catch((error) => {
    console.error(
      "Initial database connection failed. Endpoints may fail.",
      error,
    );
  });

// This tells Express that every request that goes to /api must pass through siteHandler first.
app.use("/api", siteHandler);

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

module.exports = app;
