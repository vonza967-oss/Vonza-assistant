import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { cleanText } from "./text.js";

function deriveKey(secret) {
  const normalized = cleanText(secret);

  if (!normalized) {
    const error = new Error(
      "Missing environment variables: GOOGLE_TOKEN_ENCRYPTION_SECRET"
    );
    error.statusCode = 500;
    throw error;
  }

  return createHash("sha256").update(normalized).digest();
}

export function hashToken(value) {
  return createHash("sha256").update(cleanText(value)).digest("hex");
}

export function encryptSecret(secret, keyMaterial) {
  const normalized = cleanText(secret);

  if (!normalized) {
    return "";
  }

  const key = deriveKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload, keyMaterial) {
  const normalized = cleanText(payload);

  if (!normalized) {
    return "";
  }

  const [ivPart, authTagPart, encryptedPart] = normalized.split(".");

  if (!ivPart || !authTagPart || !encryptedPart) {
    const error = new Error("Encrypted secret payload is invalid.");
    error.statusCode = 500;
    throw error;
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(keyMaterial),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
