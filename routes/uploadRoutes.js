import express from "express";
import fs from "fs";

import upload from "../middleware/multerStorage.js";
import cloudinary from "../config/cloudinary.js";
import { encryptFile } from "../utils/encryptFile.js";
import EncryptedFile from "../models/EncryptedFile.js";

const router = express.Router();

router.post("/upload", upload.single("image"), async (req, res) => {

  try {

    const originalPath = req.file.path;
    const encryptedPath = originalPath + ".enc";

    const { iv, authTag } =
      await encryptFile(originalPath, encryptedPath);

    fs.unlinkSync(originalPath);

    const uploadResult = await cloudinary.uploader.upload(
      encryptedPath,
      {
        resource_type: "raw",
        folder: "encrypted-files"
      }
    );

    fs.unlinkSync(encryptedPath);

    const maxDownloads =
      req.body.maxDownloads !== undefined
        ? Number(req.body.maxDownloads)
        : -1;

    const TEN_MINUTES = 10 * 60 * 1000;

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

    const baseUrl =
      `${req.protocol}://${req.get("host")}`;

    const qrURL =
      `${baseUrl}/file/${fileDoc._id}`;

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
    res.status(500).json({
      error: "Upload failed"
    });

  }

});

export default router;