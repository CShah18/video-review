const express = require("express");
require("dotenv").config();
const videoReview = require("./videoReview");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const https = require("https");

const port = process.env.PORT || 3000;

const app = express();
app.use(cors());

// Set EJS as the view engine
app.set("view engine", "ejs");

// JSON body parser with a limit of 50 megabytes
app.use(express.json({ limit: "50mb" }));

// URL-encoded body parser with a limit of 50 megabytes and extended mode
app.use(
  express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 })
);

// Text body parser with a limit of 200 megabytes
app.use(express.text({ limit: "200mb" }));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Dynamic route to handle user names
app.get("/:name", (req, res) => {
  const name = req.params.name;
  const formattedName =
    name.charAt(0).toUpperCase() + name.slice(1);
  res.render("index", { name: formattedName });
});

app.use("/api/v1/videoReview", videoReview);

// Default error handler for unhandled routes
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handling middleware (for unexpected errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Load SSL certificates
const sslOptions = {
  key: fs.readFileSync("./private.key"),  // Path to your private key
  cert: fs.readFileSync("./certificate.crt"),  // Path to your certificate
};

// Start the HTTPS server
https.createServer(sslOptions, app).listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

app.on("error", (error) => {
  console.log(`Error in starting the server: ${error.message}`);
});
