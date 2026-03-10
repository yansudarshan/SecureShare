import express from "express";
import EncryptedFile from "../models/EncryptedFile.js";

const router = express.Router();

router.get("/file/:uid", async (req, res) => {

  try {

    const fileDoc =
      await EncryptedFile.findById(req.params.uid);

    if (!fileDoc)
      return res.status(404).send("File not found");

    if (new Date() > fileDoc.expiresAt)
      return res.status(410).send("File expired");

    if (
      fileDoc.maxDownloads !== -1 &&
      fileDoc.downloadCount >= fileDoc.maxDownloads
    ) {
      return res.status(429)
        .send("Download limit reached");
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

      <a href="/download/${fileDoc._id}" onclick="setTimeout(()=>location.reload(),1000)">
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

export default router;