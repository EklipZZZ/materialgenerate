import assert from "node:assert/strict";
import test from "node:test";
import { buildProviderRequest, byokSchema, isAllowedModel } from "../src/server/models.ts";

test("OpenAI uses the fixed endpoint and developer role adapter", async () => {
  const request = buildProviderRequest({
    provider: "openai",
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: "System instruction" },
      { role: "user", content: "User prompt" },
    ],
    temperature: 0.2,
    topP: 0.7,
    maxTokens: 1000,
  });

  const body = request.body as Record<string, unknown>;
  assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
  assert.equal((body.messages as Array<{ role: string }>)[0].role, "developer");
  assert.equal(body.max_completion_tokens, 1000);
  assert.equal(body.temperature, undefined);
  assert.equal(body.top_p, undefined);
});

test("DeepSeek keeps system role and Chat Completions parameters", async () => {
  const request = buildProviderRequest({
    provider: "deepseek",
    model: "deepseek-v4-flash",
    messages: [{ role: "system", content: "System instruction" }],
    temperature: 0.3,
    topP: 0.8,
    maxTokens: 1000,
  });

  const body = request.body as Record<string, unknown>;
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal((body.messages as Array<{ role: string }>)[0].role, "system");
  assert.equal(body.max_tokens, 1000);
  assert.equal(body.temperature, 0.3);
  assert.equal(body.top_p, 0.8);
});

test("model policy rejects arbitrary providers and models", async () => {
  assert.equal(isAllowedModel("openai", "gpt-5-mini"), true);
  assert.equal(isAllowedModel("deepseek", "deepseek-v4-pro"), true);
  assert.equal(isAllowedModel("openai", "https://attacker.example/model"), false);
  assert.equal(isAllowedModel("custom", "gpt-5-mini"), false);
  assert.equal(byokSchema.safeParse({
    provider: "openai",
    model: "https://attacker.example/model",
    apiKey: "test-provider-key",
  }).success, false);
});
