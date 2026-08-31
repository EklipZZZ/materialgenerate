import assert from "node:assert/strict";
import test from "node:test";
import { decryptApiKey, encryptApiKey } from "../src/server/secrets.ts";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

test("API keys round-trip through AES-256-GCM without exposing plaintext fields", () => {
  const encrypted = encryptApiKey("sk-test-secret-value", TEST_KEY);
  assert.equal(decryptApiKey(encrypted, TEST_KEY), "sk-test-secret-value");
  assert.equal(encrypted.key_last4, "alue");
  assert.equal(encrypted.ciphertext.includes("sk-test-secret-value"), false);
  assert.throws(() => decryptApiKey(encrypted, Buffer.alloc(32, 8).toString("base64")));
});
