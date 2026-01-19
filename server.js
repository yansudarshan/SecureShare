import express from "express";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import {v2 as cloudinary} from 'cloudinary';
import dotenv from "dotenv";
import connectDB from "./db.js";
import EncryptedFile from "./models/EncryptedFile.js";
import fetch from "node-fetch";


dotenv.config();

// multer is a middleware to store /upload file to backend
const app = express();
app.use(cors());

const algorithm = "aes-256-gcm";
const key = Buffer.from(process.env.ENCRYPTION_KEY);
//per file iv is diffrent, key is same,authTag is diffrent

//cloudinary configuration
   cloudinary.config({
      cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
      api_key:process.env.CLOUDINARY_API_KEY,
      api_secret:process.env.CLOUDINARY_API_SECRET
});

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// Encrypt file function
//Returns iv and authTag which will be stored in MongoDB
function encryptFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(12); 
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    input.pipe(cipher).pipe(output);

    output.on("finish", () => {
      const authTag = cipher.getAuthTag();
      resolve({ iv, authTag });
    });

    output.on("error", reject);
  });
}


//upload route -----------------------------------------------------------------------------------

//from the encrypt file fn take original file,encrypted file,iv and authTag
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const originalPath = req.file.path;
    const encryptedPath = originalPath + ".enc";

    const { iv, authTag } = await encryptFile(
      originalPath,
      encryptedPath
    );

    // Optional: delete original file
    fs.unlinkSync(originalPath);

//encryptedPath has path of encrypted file(binary so upload as resource type-raw) which need to be stored on cloudinary
//uploading to cloudinary
    const uploadResult= await cloudinary.uploader.upload(
    encryptedPath,
    {
    resource_type: "raw",
    folder: "encrypted-files"
  }
) ;

let maxDownloads = -1; // default unlimited
    if (req.body.maxDownloads !== undefined) {
      maxDownloads = Number(req.body.maxDownloads);
    }


//need to store metadata in mongoDB - cloudinaryURL,iv,authTag,algorith,time,originalfilename(),mimetype()
  const TEN_MINUTES = 10 * 60 * 1000;  
  const fileDoc = await EncryptedFile.create({
  cloudinaryUrl: uploadResult.secure_url,
  iv: iv.toString("base64"),
  authTag: authTag.toString("base64"),
  originalName: req.file.originalname,
  mimeType: req.file.mimetype,
  expiresAt: new Date(Date.now() + TEN_MINUTES),
  maxDownloads,      
  downloadCount: 0
});
// ab fileDoc ke paas id hogi of  uplpoad in MongoDB as fileDoc._id . this is our UID

//making of URL on backend  but QR will be made on frontend
const baseUrl = `${req.protocol}://${req.get('host')}`;
const downloadURL = `${baseUrl}/savedFile/${fileDoc._id}`;

// it sends data to frontend from backend
res.json({
      message: "File uploaded and encrypted successfully",
       iv: iv.toString("base64"),                // iv ke paas IV hai
       authTag: authTag.toString("base64"),     // authTag ke paas authTag hai
       cloudinaryURL:uploadResult.secure_url,  //cloudinaryURL ke paas  cloudinaryimageurl hai
       UID: fileDoc._id,                      // UID has mongoDB id
       downloadURL,                            // URL of file is made and send to frontend
       expiresAt:fileDoc.expiresAt,
       maxDownloads: fileDoc.maxDownloads,
      downloadCount: fileDoc.downloadCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Encryption failed" });
  }
});
// upload route ends-------------------------------------------------------------------------------

// download route----------------------------------------------------------------------------------

app.get("/savedFile/:uid", async (req, res) => {
  try {
    console.log("Route hit!");
    // 1️ Extract UID from URL
    const { uid } = req.params;
    console.log("UID:", req.params.uid);
  // 2 Fetch metadata from MongoDB
    const fileDoc = await EncryptedFile.findById(uid);
  //checking for file expiry 
    if (new Date() > fileDoc.expiresAt) {
    return res.status(410).json({
     error: "This File has been expired"
    });
   }
  // checking for download limit 
  if (
  fileDoc.maxDownloads !== -1 &&
  fileDoc.downloadCount >= fileDoc.maxDownloads
  ) {
  return res.status(429).json({
    error: "Download limit reached"
  });
  }

   //checking for invalid url
    if (!fileDoc) {
      return res.status(404).json({ error: "File not found" });
    }
    console.log("Mongo result:", fileDoc);

  const {
      cloudinaryUrl,
      iv,
      authTag,
      mimeType,
      originalName
    } = fileDoc;

  // 3️ Fetch encrypted file from Cloudinary
    const cloudRes = await fetch(cloudinaryUrl);
    if (!cloudRes.ok) {
      return res.status(500).json({ error: "Failed to fetch encrypted file" });
    }

  const encryptedBuffer = Buffer.from(
      await cloudRes.arrayBuffer()
    );

  // 4️ Decrypt file
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "utf-8");
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = Buffer.from(authTag, "base64");

  const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      ivBuffer
    );

  decipher.setAuthTag(authTagBuffer);

  const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);
//  add increment to file count
   fileDoc.downloadCount += 1;
   await fileDoc.save();
//delete file if limit reached
   if (fileDoc.downloadCount >= fileDoc.maxDownloads) {
  await fileDoc.deleteOne();
}

  res.setHeader(
      "Content-Disposition",
      `inline; filename="${originalName || "file"}"`
    );
   
  res.send(decryptedBuffer);
     } 
     catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "File decryption failed" });
  }
});
//download route ends-------------------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await connectDB(); // 🔥 WAIT for MongoDB
    app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();




