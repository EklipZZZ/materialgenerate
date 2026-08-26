import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import { decryptApiKeyValue, encryptApiKeyValue } from "../src/crypto-core.js";
import { isAllowedModel } from "../src/models.js";

test("API keys are encrypted with authenticated encryption and are not serialized in plaintext", () => {
  const secret = "test-encryption-secret";
  const apiKey = "test-provider-key-that-must-not-appear-in-storage";
  const encrypted = encryptApiKeyValue(apiKey, secret);
  assert.equal(decryptApiKeyValue(encrypted, secret), apiKey);
  assert.notEqual(encrypted.ciphertext, apiKey);
  assert.equal(JSON.stringify(encrypted).includes(apiKey), false);
  assert.throws(() => decryptApiKeyValue(encrypted, "wrong-secret"));
});

test("server model policy rejects unsupported providers and arbitrary models", () => {
  assert.equal(isAllowedModel("openai", "gpt-5-mini"), true);
  assert.equal(isAllowedModel("deepseek", "deepseek-v4-pro"), true);
  assert.equal(isAllowedModel("openai", "https://example.com"), false);
  assert.equal(isAllowedModel("custom", "gpt-5-mini"), false);
});

test("all user-owned Node data queries retain an explicit user scope", () => {
  const routes = ["applications", "llm-configs", "enrich", "generate", "generation-records"];
  for (const route of routes) {
    const source = readFileSync(join(process.cwd(), "src", "routes", route + ".ts"), "utf8");
    assert.match(source, /\.eq\("user_id",/u, route + " must filter by user_id");
  }
});
