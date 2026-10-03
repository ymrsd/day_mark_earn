import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

let cachedSecret: string | undefined;
let cachedKey: Buffer | undefined;

export type BankDetails = {
  accountHolder: string;
  bankName: string;
  branch: string;
  accountNumber: string;
};

function encryptionKey() {
  const secret = process.env.BANK_DETAILS_ENCRYPTION_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("BANK_DETAILS_ENCRYPTION_SECRET must contain at least 32 bytes.");
  }
  if (!cachedKey || cachedSecret !== secret) {
    cachedKey = scryptSync(secret, "daymark:bank-payout:v1", 32);
    cachedSecret = secret;
  }
  return cachedKey;
}

export function isBankDetailsEncryptionConfigured() {
  const secret = process.env.BANK_DETAILS_ENCRYPTION_SECRET;
  return Boolean(secret && new TextEncoder().encode(secret).length >= 32);
}

export function encryptBankDetails(details: BankDetails) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptBankDetails(value: string | null) {
  if (!value) return null;
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Stored bank details have an unsupported format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as BankDetails;
}