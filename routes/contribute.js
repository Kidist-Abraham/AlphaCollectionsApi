const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");
const { authenticateToken } = require("../utils/middleware");
const db = require("../db");

const router = express.Router();

// Toggle between S3 and local
const ENABLE_S3 = process.env.ENABLE_S3 === "true";

// If S3 is enabled, configure AWS S3
let s3, upload;
if (ENABLE_S3) {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  upload = multer({
    storage: multerS3({
      s3,
      bucket: process.env.AWS_BUCKET_NAME,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        // We have access to req.params.id (the collection_id) and req.user.id (the user ID)
        const collectionId = req.params.id;

        // userIdHash from req.user.id
        const userIdHash = crypto
          .createHash("md5")
          .update(req.user.id.toString())
          .digest("hex");

        // Path: "<collectionId>/<userIdHash>/<timestamp_originalFilename>"
        const filePath = `${collectionId}/${userIdHash}/${Date.now()}_${file.originalname}`;
        cb(null, filePath);
      },
    }),
  });
} else {
  // Local storage approach
  const multerDisk = multer.diskStorage({
    destination: (req, file, cb) => {
      const collectionId = req.params.id;
      // make sure we have a local folder: ./uploads/<collectionId>
      const folderPath = path.join(__dirname, "..", "uploads", collectionId);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      cb(null, folderPath);
    },
    filename: (req, file, cb) => {
      // userIdHash for subfolder or prefix? Up to you, we can do:
      const userIdHash = crypto
        .createHash("md5")
        .update(req.user.id.toString())
        .digest("hex");

      const uniqueName = `${userIdHash}_${Date.now()}_${file.originalname}`;
      cb(null, uniqueName);
    },
  });

  upload = multer({ storage: multerDisk });
}

// Helper to extract S3 key from a file_url
function getKeyFromS3Url(url) {
  // e.g. "https://my-bucket.s3.amazonaws.com/123/9e107d9.../166932834_file.png"
  // We'll parse out everything after "s3.amazonaws.com/"
  const parts = url.split(".com/");
  return parts[1]; 
}

// Helper to get local file path from file_url
function getLocalPathFromUrl(url) {
  // If we stored the location as a relative path like "uploads/<collectionId>/..."
  // we can return that. If we stored an absolute path, parse accordingly.
  return url; // In practice, might need trimming or normalizing
}

/**
 * GET /collections/:id/zip
 * Zips all contributed files for a collection, from either S3 or local storage.
 */
router.get("/:id/zip", authenticateToken, async (req, res) => {
  try {
    const collectionId = req.params.id;

    // 1) Fetch contributed images for this collection
    const result = await db.query(
      `SELECT file_url
       FROM contributions
       WHERE collection_id = $1`,
      [collectionId]
    );
    const contributions = result.rows; // array of { file_url: ... }

    if (!contributions.length) {
      return res.status(404).json({ message: "No contributions found" });
    }

    // Setup headers for zip download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="collection_${collectionId}_contributions.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // 2) If S3 is enabled, download each from S3. Otherwise, read from local
    for (const { file_url } of contributions) {
      if (ENABLE_S3) {
        // S3 flow
        const key = getKeyFromS3Url(file_url);
        const s3Stream = s3
          .getObject({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
          })
          .createReadStream();

        const filename = key.split("/").pop(); // the file name
        archive.append(s3Stream, { name: filename });
      } else {
        // Local flow
        const localPath = getLocalPathFromUrl(file_url);
        if (fs.existsSync(localPath)) {
          const filename = path.basename(localPath);
          const fileStream = fs.createReadStream(localPath);
          archive.append(fileStream, { name: filename });
        }
      }
    }

    // finalize the archive
    archive.finalize();
  } catch (error) {
    console.error("Error zipping contributions:", error);
    res.status(500).json({ message: "Failed to create zip" });
  }
});

/**
 * POST /collections/:id
 * Contribute to a collection by uploading a file,
 * stored in S3 if ENABLE_S3, or locally if not.
 */
router.post("/:id", authenticateToken, upload.single("file"), async (req, res) => {
  const { id } = req.params;

  // For S3 we read `req.file.location`, for local we read `req.file.path`
  let fileUrl;
  if (ENABLE_S3) {
    fileUrl = req.file.location; // S3 file
  } else {
    fileUrl = req.file.path; // local path
  }

  try {
    await db.query(
      "INSERT INTO contributions (collection_id, user_id, file_url) VALUES ($1, $2, $3)",
      [id, req.user.id, fileUrl]
    );
    res.status(201).json({ message: "Contribution uploaded successfully", fileUrl });
  } catch (error) {
    console.error("Error saving contribution:", error);
    res.status(500).json({ message: "Failed to save contribution" });
  }
});

module.exports = router;
