import mongoose from "mongoose";

const encryptedFileSchema = new mongoose.Schema({
  cloudinaryUrl: { type: String, required: true },
  iv: { type: String, required: true },        // base64
  authTag: { type: String, required: true },   // base64
  algorithm: { type: String, default: "aes-256-gcm" },
  originalName: String,
  mimeType: String,

  expiresAt:{ type: Date, required: true },

    // DOWNLOAD LIMIT

  maxDownloads: { type: Number, default: 1 },
  downloadCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

encryptedFileSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);


export default mongoose.model("EncryptedFile", encryptedFileSchema);
