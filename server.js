// import express from "express";
// import multer from "multer";
// import cors from "cors";
// import crypto from "crypto";
// import fs from "fs";
// import {v2 as cloudinary} from 'cloudinary';
// import dotenv from "dotenv";
// import connectDB from "./db.js";
// import EncryptedFile from "./models/EncryptedFile.js";
// import fetch from "node-fetch";


// dotenv.config();

// multer is a middleware to store /upload file to backend
// const app = express();
// app.use(cors());

// const algorithm = "aes-256-gcm";
// const key = Buffer.from(process.env.ENCRYPTION_KEY);
// //per file iv is diffrent, key is same,authTag is diffrent

// //cloudinary configuration
//    cloudinary.config({
//       cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
//       api_key:process.env.CLOUDINARY_API_KEY,
//       api_secret:process.env.CLOUDINARY_API_SECRET
// });

// const storage = multer.diskStorage({
//   destination: "uploads/",
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "-" + file.originalname);
//   }
// });

// const upload = multer({ storage });

// // Encrypt file function
// //Returns iv and authTag which will be stored in MongoDB
// function encryptFile(inputPath, outputPath) {
//   return new Promise((resolve, reject) => {
//     const iv = crypto.randomBytes(12); 
//     const cipher = crypto.createCipheriv(algorithm, key, iv);

//     const input = fs.createReadStream(inputPath);
//     const output = fs.createWriteStream(outputPath);

//     input.pipe(cipher).pipe(output);

//     output.on("finish", () => {
//       const authTag = cipher.getAuthTag();
//       resolve({ iv, authTag });
//     });

//     output.on("error", reject);
//   });
// }


// //upload route -----------------------------------------------------------------------------------

// //from the encrypt file fn take original file,encrypted file,iv and authTag
// app.post("/upload", upload.single("image"), async (req, res) => {
//   try {
//     const originalPath = req.file.path;
//     const encryptedPath = originalPath + ".enc";

//     const { iv, authTag } = await encryptFile(
//       originalPath,
//       encryptedPath
//     );

//     // Optional: delete original file
//     fs.unlinkSync(originalPath);

// //encryptedPath has path of encrypted file(binary so upload as resource type-raw) which need to be stored on cloudinary
// //uploading to cloudinary
//     const uploadResult= await cloudinary.uploader.upload(
//     encryptedPath,
//     {
//     resource_type: "raw",
//     folder: "encrypted-files",
//   }
// ) ;
// fs.unlinkSync(encryptedPath);

// let maxDownloads = -1; // default unlimited
//     if (req.body.maxDownloads !== undefined) {
//       maxDownloads = Number(req.body.maxDownloads);
//     }


// //need to store metadata in mongoDB - cloudinaryURL,iv,authTag,algorith,time,originalfilename(),mimetype()
//   const TEN_MINUTES = 10 * 60 * 1000;  
//   const fileDoc = await EncryptedFile.create({
//   cloudinaryUrl: uploadResult.secure_url,
//   iv: iv.toString("base64"),
//   authTag: authTag.toString("base64"),
//   originalName: req.file.originalname,
//   mimeType: req.file.mimetype,
//   expiresAt: new Date(Date.now() + TEN_MINUTES),
//   maxDownloads,      
//   downloadCount: 0
// });
// // ab fileDoc ke paas id hogi of  uplpoad in MongoDB as fileDoc._id . this is our UID

// //making of URL on backend  but QR will be made on frontend
// const baseUrl = `${req.protocol}://${req.get('host')}`;
// const downloadURL = `${baseUrl}/savedFile/${fileDoc._id}`;

// // it sends data to frontend from backend
// res.json({
//       message: "File uploaded and encrypted successfully",
//        iv: iv.toString("base64"),                // iv ke paas IV hai
//        authTag: authTag.toString("base64"),     // authTag ke paas authTag hai
//        cloudinaryURL:uploadResult.secure_url,  //cloudinaryURL ke paas  cloudinaryimageurl hai
//        UID: fileDoc._id,                      // UID has mongoDB id
//        downloadURL,                            // URL of file is made and send to frontend
//        expiresAt:fileDoc.expiresAt,
//        maxDownloads: fileDoc.maxDownloads,
//       downloadCount: fileDoc.downloadCount
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Encryption failed" });
//   }
// });
// // upload route ends-------------------------------------------------------------------------------

// // download route----------------------------------------------------------------------------------

// app.get("/savedFile/:uid", async (req, res) => {
//   try {
//     //console.log("Route hit!");
//     // 1️ Extract UID from URL
//     const { uid } = req.params;
//    // console.log("UID:", req.params.uid);

//   // 2 Fetch metadata from MongoDB
//     const fileDoc = await EncryptedFile.findById(uid);
//     //checking for invalid url
//     if (!fileDoc) {
//       return res.status(404).json({ error: "File not found" });
//     }
//   //  console.log("Mongo result:", fileDoc);

//   //checking for file expiry 
//     if (new Date() > fileDoc.expiresAt) {
//     return res.status(410).json({
//      error: "This File has been expired"
//     });
//    }
//   // checking for download limit 
//   if (
//   fileDoc.maxDownloads !== -1 &&
//   fileDoc.downloadCount >= fileDoc.maxDownloads
//   ) {
//   return res.status(429).json({
//     error: "Download limit reached"
//   });
//   }

//   const {
//       cloudinaryUrl,
//       iv,
//       authTag,
//       mimeType,
//       originalName
//     } = fileDoc;

//   // 3️ Fetch encrypted file from Cloudinary
//     const cloudRes = await fetch(cloudinaryUrl);
//     if (!cloudRes.ok) {
//       return res.status(500).json({ error: "Failed to fetch encrypted file" });
//     }

//   const encryptedBuffer = Buffer.from(
//       await cloudRes.arrayBuffer()
//     );

//   // 4️ Decrypt file
//     const key = Buffer.from(process.env.ENCRYPTION_KEY );
//     const ivBuffer = Buffer.from(iv, "base64");
//     const authTagBuffer = Buffer.from(authTag, "base64");

//   const decipher = crypto.createDecipheriv(
//       "aes-256-gcm",
//       key,
//       ivBuffer
//     );

//   decipher.setAuthTag(authTagBuffer);

//   const decryptedBuffer = Buffer.concat([
//       decipher.update(encryptedBuffer),
//       decipher.final()
//     ]);
// //  add increment to file count
//    fileDoc.downloadCount += 1;
//    await fileDoc.save();
// //delete file if limit reached
//    if (fileDoc.downloadCount >= fileDoc.maxDownloads) {
//   await fileDoc.deleteOne();
// }

//   res.setHeader(
//       "Content-Disposition",
//       `inline; filename="${originalName || "file"}"`
//     );
   
//   res.send(decryptedBuffer);
//      } 
//      catch (err) {
//     console.error("Download error:", err);
//     res.status(500).json({ error: "File decryption failed" });
//   }
// });
// //download route ends-------------------------------------------------------------------------------------
// const PORT = process.env.PORT || 5000;
// const startServer = async () => {
//   try {
//     await connectDB(); //  WAIT for MongoDB
//     app.listen(PORT, () => {
//   console.log(`Server running on ${PORT}`);
//     });
//   } catch (err) {
//     console.error("Failed to start server:", err);
//     process.exit(1);
//   }
// };

// startServer();











import nodemailer from "nodemailer";
import QRCode from "qrcode";
import validator from "validator";
import express from "express";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";
import fs from "fs"; // fs is File System used for file opeartions like creating, modifiying
import dotenv from "dotenv";
import fetch from "node-fetch";
import { v2 as cloudinary } from "cloudinary";

import connectDB from "./db.js";
import EncryptedFile from "./models/EncryptedFile.js";

dotenv.config();

const app = express();
app.use(cors());


const algorithm = "aes-256-gcm";
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// port for smtp protocol
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Multer is a middleware to upload to backend
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });


// path of file which is to be upload
function encryptFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
//per file iv is diffrent, key is same, authTag is diffrent
//Returns iv and authTag which will be stored in MongoDB


    fs.createReadStream(inputPath)
      .pipe(cipher)
      .pipe(fs.createWriteStream(outputPath))
      .on("finish", () => {
        resolve({ iv, authTag: cipher.getAuthTag() });
      })
      .on("error", reject);
  });
}

/* Upload route------------------------------------------------------------------------------- */

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const originalPath = req.file.path;
    const encryptedPath = originalPath + ".enc";

//from the encrypt file fn take original file,encrypted file,iv and authTag
    const { iv, authTag } = await encryptFile(
      originalPath,
      encryptedPath
    );
//optional to delete the original file
    fs.unlinkSync(originalPath);

//encryptedPath has path of encrypted file(binary so upload as resource type-raw) which need to be stored on cloudinary
//uploading to cloudinary
    const uploadResult = await cloudinary.uploader.upload(
      encryptedPath,
      { resource_type: "raw", folder: "encrypted-files" }
    );
//delete the encrypted file path once uploaded to cloudinary. now no use
    fs.unlinkSync(encryptedPath);

    const maxDownloads =
      req.body.maxDownloads !== undefined
        ? Number(req.body.maxDownloads)
        : -1;

    const TEN_MINUTES = 10 * 60 * 1000;

//need to store metadata in mongoDB - cloudinaryURL,iv,authTag,algorith,time,originalfilename(),mimetype()
    const fileDoc = await EncryptedFile.create({
      cloudinaryUrl: uploadResult.secure_url,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      expiresAt: new Date(Date.now() + TEN_MINUTES),
      maxDownloads,
      downloadCount: 0,
    });
// ab fileDoc ke paas id hogi of  uplpoad in MongoDB as fileDoc._id . this is our UID
//fileDoc=UID

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const qrURL = `${baseUrl}/file/${fileDoc._id}`;
//msg to frontend
    res.json({
      message: "File uploaded & encrypted",
      UID: fileDoc._id,
      downloadURL: qrURL,
      expiresAt: fileDoc.expiresAt,
      maxDownloads: fileDoc.maxDownloads,
      downloadCount: fileDoc.downloadCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});
// upload route end---------------------------------------------------------


// file info ---------------------------------------------------
app.get("/file/:uid", async (req, res) => {
  try {
    // 1️ Extract UID from URL
    const fileDoc = await EncryptedFile.findById(req.params.uid);

    if (!fileDoc) return res.status(404).send("File not found");
    if (new Date() > fileDoc.expiresAt)
      return res.status(410).send("File expired");

    if (
      fileDoc.maxDownloads !== -1 &&
      fileDoc.downloadCount >= fileDoc.maxDownloads
    ) {
      return res.status(429).send("Download limit reached");
    }

    const remaining =
      fileDoc.maxDownloads === -1
        ? "∞"
        : fileDoc.maxDownloads - fileDoc.downloadCount;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SecureShare</title>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
        </head>
        <body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>${fileDoc.originalName}</h2>
          <p>Downloads left: <b>${remaining}</b></p>
          <a href="/download/${fileDoc._id}">
            <button style="padding:14px 28px;font-size:16px;cursor:pointer">
              ⬇ Download File
            </button>
          </a>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

//share route ------------------------------------------------
app.post("/share", express.json(), async (req, res) => {
  try {
      
    const { email, uid } = req.body;
     console.log("share route hit");
     console.log("BODY:", req.body);

    // check valid 

    if (!email || !uid) {
      return res.status(400).json({ error: "Email and UID required" });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    //  Get file from uid 
    const fileDoc = await EncryptedFile.findById(uid);

    if (!fileDoc) {
      return res.status(404).json({ error: "File not found" });
    }
    if (new Date() > fileDoc.expiresAt) {
      return res.status(410).json({ error: "File expired" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const fileURL = `${baseUrl}/file/${uid}`;

    const qrImage = await QRCode.toDataURL(fileURL);

    //EMAIL TEMPLATE ------------------------------------------
    const htmlTemplate = `
      <div style="font-family:Arial;padding:20px">
        <h2>SecureShare</h2>

        <p>A file has been shared with you.</p>

        <p><b>File:</b> ${fileDoc.originalName}</p>

        <p><b>Expires:</b> ${new Date(fileDoc.expiresAt).toLocaleString()}</p>

        <p><b>Download Link:</b></p>

        <a href="${fileURL}">
          ${fileURL}
        </a>

        <p style="margin-top:20px"><b>QR Code:</b></p>

        <img src="${qrImage}" width="200"/>

        <p style="margin-top:20px;font-size:12px;color:gray">
        This link may expire automatically.
        </p>
      </div>
    `;
    // SEND EMAIL ---------------------------------- 
    await transporter.sendMail({
      from: `"SecureShare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "File Shared With You",
      html: htmlTemplate
    });

    res.json({
      message: "Email sent successfully"
    });

  } catch (err) {
    console.error("Share error:", err);
    res.status(500).json({
      error: "Failed to send email" 
    });
  }
});
// share route ends ----------------------------------------

// download route
app.get("/download/:uid", async (req, res) => {
  try {
    // 1️ Extract UID from URL
    const fileDoc = await EncryptedFile.findById(req.params.uid);

    if (!fileDoc) return res.status(404).json({ error: "Not found" });
    if (new Date() > fileDoc.expiresAt)
      return res.status(410).json({ error: "Expired" });

    if (
      fileDoc.maxDownloads !== -1 &&
      fileDoc.downloadCount >= fileDoc.maxDownloads
    ) {
      return res.status(429).json({ error: "Limit reached" });
    }
//2 fetch cloudinary URL fro UID(mongoDB)
    const cloudRes = await fetch(fileDoc.cloudinaryUrl);
    if (!cloudRes.ok)
      return res.status(500).json({ error: "Cloud fetch failed" });

    const encryptedBuffer = Buffer.from(
      await cloudRes.arrayBuffer()
    );
// 3 decrypt the cloudinary file by using metadata in UID(mongoDB)
    const decipher = crypto.createDecipheriv(
      algorithm,
      ENCRYPTION_KEY,
      Buffer.from(fileDoc.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(fileDoc.authTag, "base64"));

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    fileDoc.downloadCount += 1;
    await fileDoc.save();

    if (
      fileDoc.maxDownloads !== -1 &&
      fileDoc.downloadCount >= fileDoc.maxDownloads
    ) {
      await fileDoc.deleteOne();
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileDoc.originalName}"`
    );
    //4 as decryption over, send to frontend
    res.send(decryptedBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

//update in download left ke liye route
app.get("/file-info/:uid", async (req, res) => {
  try {

    const fileDoc = await EncryptedFile.findById(req.params.uid);

    if (!fileDoc) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json({
      downloadCount: fileDoc.downloadCount,
      maxDownloads: fileDoc.maxDownloads,
      expiresAt: fileDoc.expiresAt
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch file info" });
  }
});



const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () =>
    console.log(` Server running on port ${PORT}`),
    console.log("started")
  );
}; 

startServer();


