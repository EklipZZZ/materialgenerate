import { env } from "./env.js";
import { decryptApiKeyValue, encryptApiKeyValue } from "./crypto-core.js";

export function encryptApiKey(apiKey: string) {
  return encryptApiKeyValue(apiKey, env.encryptionSecret);
}

export function decryptApiKey(row: {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
}): string {
  return decryptApiKeyValue(row, env.encryptionSecret);
}
