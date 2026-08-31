import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = 1;

function defaultKeyMaterial(): string {
  const value = process.env.LLM_CONFIG_ENCRYPTION_KEY;
  if (!value) throw new Error("Missing required server configuration: LLM_CONFIG_ENCRYPTION_KEY");
  return value;
}

function decodeKey(value: string): Buffer {
  const trimmed = value.trim();
  const key = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new Error("LLM config encryption key must be 32 bytes");
  return key;
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
  key_last4: string;
}

export function encryptApiKey(apiKey: string, keyMaterial = defaultKeyMaterial()): EncryptedSecret {
  const value = apiKey.trim();
  if (!value) throw new Error("模型凭据无效");
  const key = decodeKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: authTag.toString("base64"),
    key_version: KEY_VERSION,
    key_last4: value.slice(-4),
  };
}

export function decryptApiKey(
  secret: Pick<EncryptedSecret, "ciphertext" | "iv" | "auth_tag" | "key_version">,
  keyMaterial = defaultKeyMaterial(),
): string {
  if (secret.key_version !== KEY_VERSION) throw new Error("模型凭据版本不受支持");
  const key = decodeKey(keyMaterial);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
