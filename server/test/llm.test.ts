import assert from "node:assert/strict";
import test from "node:test";
import { providerRequest } from "../src/providers.js";

const messages = [
  { role: "system" as const, content: "System instruction" },
  { role: "user" as const, content: "User prompt" },
];

test("OpenAI adapter uses a fixed endpoint and GPT-compatible parameters", () => {
  const request = providerRequest({
    provider: "openai",
    model: "gpt-5-mini",
    messages,
    max_tokens: 1000,
    temperature: 0.2,
  });
  assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
  assert.equal((request.body as Record<string, unknown>).max_completion_tokens, 1000);
  assert.equal((request.body as Record<string, unknown>).max_tokens, undefined);
  assert.equal((request.body as Record<string, unknown>).temperature, undefined);
  assert.equal((request.body.messages[0] as { role: string }).role, "developer");
});

test("DeepSeek adapter uses a fixed endpoint and Chat Completions parameters", () => {
  const request = providerRequest({
    provider: "deepseek",
    model: "deepseek-v4-flash",
    messages,
    max_tokens: 1000,
    temperature: 0.3,
  });
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal((request.body as Record<string, unknown>).max_tokens, 1000);
  assert.equal((request.body as Record<string, unknown>).temperature, 0.3);
  assert.equal((request.body.messages[0] as { role: string }).role, "system");
});

test("provider adapter rejects arbitrary models and URLs", () => {
  assert.throws(() => providerRequest({
    provider: "openai",
    model: "https://attacker.example/model",
    messages,
  }));
});
