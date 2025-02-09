const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const AWS = require("aws-sdk");
const { authenticateToken } = require("../utils/middleware");
const db = require("../db");
const sharp = require("sharp");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// Toggle between S3 and local
const ENABLE_S3 = process.env.ENABLE_S3 === "true";

// If S3 is enabled, configure AWS S3
let s3;
if (ENABLE_S3) {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
}

// Helper to extract S3 key from a file_url
function getKeyFromS3Url(url) {
  const parts = url.split(".com/");
  return parts[1]; 
}

// Helper to get local file path from file_url
function getLocalPathFromUrl(url) {
  return url; 
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

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="collection_${collectionId}_contributions.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

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

        const filename = key.split("/").pop(); 
        archive.append(s3Stream, { name: filename });
      } else {
        const localPath = getLocalPathFromUrl(file_url);
        if (fs.existsSync(localPath)) {
          const filename = path.basename(localPath);
          const fileStream = fs.createReadStream(localPath);
          archive.append(fileStream, { name: filename });
        }
      }
    }

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


// Create a limiter that allows 5 contributions per user/IP per minute
const contributionLimiter = rateLimit({
  windowMs: 60 * 1000,   
  max: 5,                
  message: "Too many contributions from this IP, please try again later."
});
router.post("/:id", authenticateToken, contributionLimiter, async (req, res) => {
    const { id } = req.params;
    const { image } = req.body;
  
    try {
      if (!image) {
        return res.status(400).json({ message: "No base64 image provided" });
      }
      const buffer = Buffer.from(image, "base64");
      const processedBuffer = await sharp(buffer)
        .resize(400, 400, { fit: "cover" })   // size normalization to 400x400
        .gamma(2.0)                            // basic contrast adjustment
        .toColourspace("rgb")                  // ensure RGB
        .normalize()                            // auto contrast stretch
        .toBuffer();
  
      let fileUrl;
  
      if (ENABLE_S3) {

        const userIdHash = crypto
          .createHash("md5")
          .update(req.user.id.toString())
          .digest("hex");
        const filePath = `${id}/${userIdHash}/${Date.now()}_canvas.png`;
        await s3
          .putObject({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: filePath,
            Body: processedBuffer,
            ContentType: "image/png",
          })
          .promise();
  
        fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
      } else {
        const folderPath = path.join(__dirname, "..", "uploads", id);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  
        const userIdHash = crypto
          .createHash("md5")
          .update(req.user.id.toString())
          .digest("hex");
        const filename = `${userIdHash}_${Date.now()}_canvas.png`;
        const localPath = path.join(folderPath, filename);
  
        fs.writeFileSync(localPath, processedBuffer);
        fileUrl = localPath;
      }
  
      await db.query(
        "INSERT INTO contributions (collection_id, user_id, file_url) VALUES ($1, $2, $3)",
        [id, req.user.id, fileUrl]
      );
  
      return res.status(201).json({ message: "Contribution uploaded", fileUrl });
    } catch (error) {
      console.error("Error saving base64 contribution:", error);
      return res.status(500).json({ message: "Failed to save contribution" });
    }
  });
  

module.exports = router;
