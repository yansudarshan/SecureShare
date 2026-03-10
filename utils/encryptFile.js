import crypto from "crypto";
import fs from "fs";

const algorithm = "aes-256-gcm";
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY);

export function encryptFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {

    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
      algorithm,
      ENCRYPTION_KEY,
      iv
    );

    fs.createReadStream(inputPath)
      .pipe(cipher)
      .pipe(fs.createWriteStream(outputPath))
      .on("finish", () => {
        resolve({ iv, authTag: cipher.getAuthTag() });
      })
      .on("error", reject);

  });
}