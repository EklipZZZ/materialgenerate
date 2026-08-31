import assert from "node:assert/strict";
import test from "node:test";
import { callLlm, LlmError, streamLlm } from "../src/server/llm.ts";
import { buildProviderRequest, byokSchema, isAllowedModel } from "../src/server/models.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
process.env.CONVERTER_SHARED_SECRET ||= "test-converter-secret";
process.env.LLM_CONFIG_ENCRYPTION_KEY ||= "test-encryption-key";
process.env.LLM_REQUEST_TIMEOUT_MS ||= "1000";

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
    thinking: "disabled",
  });

  const body = request.body as Record<string, unknown>;
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal((body.messages as Array<{ role: string }>)[0].role, "system");
  assert.equal(body.max_tokens, 1000);
  assert.equal(body.temperature, 0.3);
  assert.equal(body.top_p, 0.8);
  assert.deepEqual(body.thinking, { type: "disabled" });
});

test("LLM errors preserve safe upstream classification without response bodies", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: { code: "invalid_api_key", message: "secret details must not escape" },
  }), {
    status: 401,
    headers: { "x-request-id": "req-test-401" },
  })) as typeof fetch;

  try {
    await assert.rejects(
      () => callLlm({
        provider: "deepseek",
        model: "deepseek-v4-flash",
        apiKey: "test-provider-key",
        messages: [{ role: "user", content: "test" }],
        operation: "manual/overview",
      }),
      (error: unknown) => {
        assert.ok(error instanceof LlmError);
        assert.equal(error.info.kind, "credentials");
        assert.equal(error.info.status, 401);
        assert.equal(error.info.code, "invalid_api_key");
        assert.equal(error.info.requestId, "req-test-401");
        assert.equal(String(error).includes("secret details"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streaming provider errors and resource finish reasons are surfaced", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(
      'data: {"error":{"code":"insufficient_system_resource"}}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    ),
    new Response(
      'data: {"choices":[{"delta":{"content":"已生成"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    ),
  ];
  globalThis.fetch = (async () => responses.shift()!) as typeof fetch;

  try {
    await assert.rejects(
      () => streamLlm({
        provider: "deepseek",
        model: "deepseek-v4-flash",
        apiKey: "test-provider-key",
        messages: [{ role: "user", content: "test" }],
        operation: "manual/functions",
        thinking: "disabled",
      }, () => undefined),
      (error: unknown) => {
        assert.ok(error instanceof LlmError);
        assert.equal(error.info.kind, "resource");
        assert.equal(error.info.code, "insufficient_system_resource");
        return true;
      },
    );

    const chunks: string[] = [];
    const content = await streamLlm({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      apiKey: "test-provider-key",
      messages: [{ role: "user", content: "test" }],
      operation: "manual/functions",
      thinking: "disabled",
    }, (chunk) => {
      chunks.push(chunk);
    });
    assert.equal(content, "已生成");
    assert.deepEqual(chunks, ["已生成"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
