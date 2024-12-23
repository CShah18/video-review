const express = require("express");
require("dotenv").config();
const videoReview = require("./videoReview");
const cors = require("cors");
const path = require("path");

const port = process.env.PORT;

const app = express();
app.use(cors());

app.use(express.static("public"));

// JSON body parser with a limit of 50 megabytes
app.use(express.json({ limit: "50mb" }));

// URL-encoded body parser with a limit of 50 megabytes and extended mode
app.use(
  express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 })
);

// Text body parser with a limit of 200 megabytes
app.use(express.text({ limit: "200mb" }));

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

app.on("error", (error) => {
  console.log(`Error in starting the server: ${error.message}`);
});
