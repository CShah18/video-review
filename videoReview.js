const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require('path');
const util = require("util");

// Promisify fs.rename to use with async/await
const renameAsync = util.promisify(fs.rename);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      const destDirectory = path.join(process.cwd(), "uploads")
  
      if (!fs.existsSync(destDirectory)) {
        fs.mkdirSync(destDirectory, { recursive: true });
      }
  
      cb(null, destDirectory);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

function checkFileType(file, cb) {
  const filetypes = /mp4|mov|wmv|avi|mkv|webm/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    return cb(null, true);
  } else {
    cb("Error: MP4, MOV, WMV, AVI, MKV or WebM files only!");
  }
}

const fileUpload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

router.post("/submit", fileUpload.single("videoReview"), async (req, res) => {
  const userName = req.body.userName;
  const uploadedFilePath = req.file.path;

  // Create the user directory if it doesn't exist
  const userDir = path.join(__dirname, "uploads", userName); // The target folder path

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true }); // Create directory if it doesn't exist
  }

  // Move the file to the new directory
  const newFilePath = path.join(userDir, req.file.filename);
  await renameAsync(uploadedFilePath, newFilePath);

  return res.send("Success");
});

module.exports = router;
