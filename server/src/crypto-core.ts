import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const version = 1;

export interface EncryptedApiKey {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
  key_last4: string;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptApiKeyValue(apiKey: string, secret: string): EncryptedApiKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    key_version: version,
    key_last4: apiKey.slice(-4),
  };
}

export function decryptApiKeyValue(
  row: Pick<EncryptedApiKey, "ciphertext" | "iv" | "auth_tag" | "key_version">,
  secret: string,
): string {
  if (row.key_version !== version) throw new Error("Unsupported encrypted key version");
  const decipher = createDecipheriv(
    algorithm,
    encryptionKey(secret),
    Buffer.from(row.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
