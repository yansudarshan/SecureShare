import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

import EncryptedFile from "../models/EncryptedFile.js";

const router = express.Router();

const algorithm = "aes-256-gcm";
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);

router.get("/download/:uid", async (req, res) => {

  try {

    const fileDoc =
      await EncryptedFile.findById(req.params.uid);

    if (!fileDoc)
      return res.status(404).json({ error: "Not found" });

    if (new Date() > fileDoc.expiresAt)
      return res.status(410).json({ error: "Expired" });

    if (
      fileDoc.maxDownloads !== -1 &&
      fileDoc.downloadCount >= fileDoc.maxDownloads
    ) {
      return res.status(429).json({
        error: "Limit reached"
      });
    }

    const cloudRes =
      await fetch(fileDoc.cloudinaryUrl);

    if (!cloudRes.ok)
      return res.status(500).json({
        error: "Cloud fetch failed"
      });

    const encryptedBuffer =
      Buffer.from(await cloudRes.arrayBuffer());

    const decipher =
      crypto.createDecipheriv(
        algorithm,
        ENCRYPTION_KEY,
        Buffer.from(fileDoc.iv, "base64")
      );

    decipher.setAuthTag(
      Buffer.from(fileDoc.authTag, "base64")
    );

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

    res.send(decryptedBuffer);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Download failed"
    });

  }

});

router.get("/file-info/:uid", async (req, res) => {

  try {

    const fileDoc =
      await EncryptedFile.findById(req.params.uid);

    if (!fileDoc)
      return res.status(404).json({
        error: "File not found"
      });

    res.json({
      downloadCount: fileDoc.downloadCount,
      maxDownloads: fileDoc.maxDownloads,
      expiresAt: fileDoc.expiresAt
    });

  } catch (err) {

    res.status(500).json({
      error: "Failed to fetch file info"
    });

  }

});

export default router;