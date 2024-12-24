const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require('path');
const util = require("util");
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

// Promisify fs.rename to use with async/await
const renameAsync = util.promisify(fs.rename);

// Initialize the S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

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
  try {
    const userName = req.body.userName;
    const uploadedFilePath = req.file.path;
    const fileName = req.file.filename;

    processFile(userName, uploadedFilePath, fileName, req);

    return res.status(200).send(`File processing started successfully`);
  } catch (error) {
    return res.status(500).send(`Something went wrong while processing the file. Error: ${error.message}`);
  }
});

async function processFile(userName, uploadedFilePath, fileName, req) {
  try {
    // Create the user directory if it doesn't exist
    const userDir = path.join(__dirname, "uploads", userName); // The target folder path

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true }); // Create directory if it doesn't exist
    }

    // Move the file to the new directory
    const newFilePath = path.join(userDir, req.file.filename);
    await renameAsync(uploadedFilePath, newFilePath);

    // Upload to S3
    const s3FolderPath = `${userName}/`; // Create a folder for the user in S3
    const s3Key = `${s3FolderPath}${fileName}`; // Full path in the S3 bucket

    // Read the file from disk
    const fileContent = fs.readFileSync(newFilePath);

    // Create the S3 upload parameters
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: req.file.mimetype,
    };

    // Upload the file to S3
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    console.log(`File uploaded successfully!`);

    // Optionally, delete the local file after upload
    fs.unlinkSync(newFilePath);
  } catch (error) {
    console.log(`Error in processing the file. Error: ${error.message}`);
  }
}

// Helper function to list all objects in the bucket
const listAllKeys = async (Prefix = '') => {
  let allKeys = [];
  let continuationToken = undefined;

  do {
      const command = new ListObjectsV2Command({
          Bucket: process.env.AWS_BUCKET_NAME,
          Prefix,
          ContinuationToken: continuationToken,
      });
      const data = await s3Client.send(command);

      if (data.Contents) {
          allKeys = allKeys.concat(data.Contents.map((item) => item.Key));
      }

      continuationToken = data.IsTruncated ? data.NextContinuationToken : undefined;
  } while (continuationToken);

  return allKeys;
};

router.get('/showFiles', async (req, res) => {
  try {
      const keys = await listAllKeys();

      // Convert flat list of keys into a nested folder structure
      const buildTree = (keys) => {
          const tree = {};

          keys.forEach((key) => {
              const parts = key.split('/');
              parts.reduce((acc, part, idx) => {
                  if (!acc[part]) {
                      acc[part] = idx === parts.length - 1 ? null : {};
                  }
                  return acc[part];
              }, tree);
          });

          return tree;
      };

      const treeStructure = buildTree(keys);

      res.json({
          success: true,
          data: treeStructure,
      });
  } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({
          success: false,
          message: 'Error fetching files',
          error: error.message,
      });
  }
});

router.get('/download', async (req, res) => {
  const filePath = req.query.filePath;

  if (!filePath) {
      return res.status(400).send('File path is required');
  }

  try {
      const command = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: filePath,
      });

      const data = await s3Client.send(command);
      const stream = data.Body;

      // Set the filename for download
      res.attachment(filePath.split('/').pop());

      // Pipe the S3 stream to the response
      Readable.from(stream).pipe(res);
  } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).send('Error downloading file');
  }
});



// TODO:: NOTE :: Below api works with the complete process in sync (step-by-step)
// router.post("/submit", fileUpload.single("videoReview"), async (req, res) => {
//   const userName = req.body.userName;
//   const uploadedFilePath = req.file.path;
//   const fileName = req.file.filename;

//   // Create the user directory if it doesn't exist
//   const userDir = path.join(__dirname, "uploads", userName); // The target folder path

//   if (!fs.existsSync(userDir)) {
//     fs.mkdirSync(userDir, { recursive: true }); // Create directory if it doesn't exist
//   }

//   // Move the file to the new directory
//   const newFilePath = path.join(userDir, req.file.filename);
//   await renameAsync(uploadedFilePath, newFilePath);

//   // Upload to S3
//   const s3FolderPath = `${userName}/`; // Create a folder for the user in S3
//   const s3Key = `${s3FolderPath}${fileName}`; // Full path in the S3 bucket

//   // Read the file from disk
//   const fileContent = fs.readFileSync(newFilePath);

//   // Create the S3 upload parameters
//   const uploadParams = {
//     Bucket: process.env.AWS_BUCKET_NAME,
//     Key: s3Key,
//     Body: fileContent,
//     ContentType: req.file.mimetype,
//   };

//   // Upload the file to S3
//   const command = new PutObjectCommand(uploadParams);
//   await s3Client.send(command);
//   console.log(`File uploaded successfully!`);

//   // Optionally, delete the local file after upload
//   fs.unlinkSync(newFilePath);

//   return res.send("Success");
// });



module.exports = router;
