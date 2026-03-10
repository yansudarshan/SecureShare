import express from "express";
import validator from "validator";
import { Resend } from "resend";

import EncryptedFile from "../models/EncryptedFile.js";

const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/share", async (req, res) => {

  try {

    const { email, uid } = req.body;

    if (!email || !uid)
      return res.status(400).json({
        error: "Email and UID required"
      });

    if (!validator.isEmail(email))
      return res.status(400).json({
        error: "Invalid email address"
      });

    const fileDoc =
      await EncryptedFile.findById(uid);

    if (!fileDoc)
      return res.status(404).json({
        error: "File not found"
      });

    if (new Date() > fileDoc.expiresAt)
      return res.status(410).json({
        error: "File expired"
      });

    const baseUrl =
      `${req.protocol}://${req.get("host")}`;

    const fileURL =
      `${baseUrl}/file/${uid}`;

    const remainingMinutes =
      Math.max(
        0,
        Math.floor(
          (fileDoc.expiresAt - Date.now()) / 60000
        )
      );

    const qrImage =
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fileURL)}`;

    const htmlTemplate = `
      <div style="font-family:Arial;padding:20px">
      <h2>SecureShare</h2>

      <p>A file has been shared with you.</p>

      <p><b>File:</b> ${fileDoc.originalName}</p>

      <p><b>Expires in:</b> ${remainingMinutes} minutes</p>

      <p><b>Download Link:</b></p>

      <a href="${fileURL}">
      ${fileURL}
      </a>

      <p style="margin-top:20px"><b>QR Code:</b></p>

      <a href="${fileURL}">
      <img src="${qrImage}" width="200"/>
      </a>

      </div>
    `;

    await resend.emails.send({
      from: "SecureShare <onboarding@resend.dev>",
      to: email,
      subject: "File Shared With You",
      html: htmlTemplate
    });

    res.json({
      message: "Email sent successfully"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to send email"
    });

  }

});

export default router;