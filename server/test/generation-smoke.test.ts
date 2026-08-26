import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { decryptApiKeyValue, encryptApiKeyValue } from "../src/crypto-core.js";

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function sendJson(response: ServerResponse, value: unknown, status = 200) {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(body);
}

test("generation route completes through Supabase, direct provider, DOCX and mocked Storage with SSE progress", async () => {
  const upstreamKey = "test-provider-key";
  const encryptionSecret = "generation-smoke-encryption-secret";
  const encrypted = encryptApiKeyValue(upstreamKey, encryptionSecret);
  assert.equal(decryptApiKeyValue(encrypted, encryptionSecret), upstreamKey);
  let providerCalls = 0;
  let uploadedObjects = 0;
  let generationRecordBody = "";
  const requests: string[] = [];

  const mock = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    requests.push(request.method + " " + url.pathname + url.search + " accept=" + String(request.headers.accept || ""));
    const body = await readBody(request);
    if (url.pathname === "/supabase/auth/v1/user") {
      assert.equal(request.headers.authorization, "Bearer user-token");
      return sendJson(response, { id: "user-a", email: "a@example.com" });
    }
    if (url.pathname === "/supabase/rest/v1/llm_configs" && request.method === "GET") {
      const row = {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "user-a",
        name: "smoke",
        provider: "openai",
        model: "gpt-5-mini",
        ...encrypted,
      };
      return sendJson(response, request.headers.accept?.includes("vnd.pgrst.object") ? row : [row]);
    }
    if (url.pathname === "/supabase/rest/v1/generation_records" && request.method === "POST") {
      generationRecordBody = body.toString("utf8");
      const row = { id: "33333333-3333-4333-8333-333333333333" };
      return sendJson(response, request.headers.accept?.includes("vnd.pgrst.object") ? row : [row]);
    }
    if (url.pathname === "/supabase/rest/v1/applications" && request.method === "GET") {
      const row = {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "user-a",
        software_full_name: "Smoke Software",
        software_short_name: "Smoke",
        version: "V1.0",
        status: "draft",
      };
      return sendJson(response, request.headers.accept?.includes("vnd.pgrst.object") ? row : [row]);
    }
    if (url.pathname === "/provider/chat/completions") {
      assert.equal(request.headers.authorization, "Bearer " + upstreamKey);
      assert.equal(body.toString("utf8").includes(upstreamKey), false);
      assert.equal(body.toString("utf8").includes("max_completion_tokens"), true);
      providerCalls += 1;
      return sendJson(response, { choices: [{ message: { content: "# Generated Material\n\nThe software manages applications." } }] });
    }
    if (url.pathname.includes("/supabase/storage/v1/object/sign/")) {
      return sendJson(response, { signedURL: "/object/sign/generated-documents/test-file?token=test-token" });
    }
    if (url.pathname.startsWith("/supabase/storage/v1/object/generated-documents/")) {
      if (request.method === "POST") uploadedObjects += 1;
      return sendJson(response, { Id: "test-object-id", Key: "generated-documents/test-file" });
    }
    if (url.pathname === "/supabase/storage/v1/object/generated-documents" && request.method === "POST") {
      return sendJson(response, []);
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", () => resolve()));
  const address = mock.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;

  process.env.SUPABASE_URL = `http://127.0.0.1:${port}/supabase`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  process.env.LLM_KEY_ENCRYPTION_SECRET = encryptionSecret;
  process.env.SUPABASE_STORAGE_BUCKET = "generated-documents";
  process.env.ALLOWED_ORIGINS = "http://127.0.0.1";
  process.env.PYTHON_BIN = process.env.PYTHON_BIN || join(
    process.cwd(),
    ".test-venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const tempRoot = join(process.cwd(), ".generation-test-temp");
  await mkdir(tempRoot, { recursive: true });
  process.env.TEMP = tempRoot;
  process.env.TMP = tempRoot;

  const { createClient } = await import("@supabase/supabase-js");
  const smokeClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const smokeConfig = await smokeClient
    .from("llm_configs")
    .select("*")
    .eq("id", "22222222-2222-4222-8222-222222222222")
    .eq("user_id", "user-a")
    .maybeSingle();
  assert.equal(smokeConfig.error, null);
  assert.equal(smokeConfig.data?.key_version, 1);
  assert.equal(decryptApiKeyValue(smokeConfig.data!, encryptionSecret), upstreamKey);

  let appServer: ReturnType<typeof createServer> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://api.openai.com/v1/chat/completions") {
      return originalFetch(`http://127.0.0.1:${port}/provider/chat/completions`, init);
    }
    return originalFetch(input, init);
  };
  try {
    const expressModule = await import("express");
    const productionRouteModule = "../../dist/routes/generate.js";
    const { generateRouter } = await import(productionRouteModule);
    const app = expressModule.default();
    app.use("/api/generate", generateRouter);
    const runningServer = await new Promise<ReturnType<typeof createServer>>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });
    appServer = runningServer;
    const appAddress = runningServer.address();
    assert.ok(appAddress && typeof appAddress === "object");
    const form = new FormData();
    form.set("application_id", "11111111-1111-4111-8111-111111111111");
    form.set("config_id", "22222222-2222-4222-8222-222222222222");
    form.set("skip_analyze", "1");
    form.set("table_template", "# Collection Form\n\nSmoke application");
    const response = await fetch(`http://127.0.0.1:${appAddress.port}/api/generate`, {
      method: "POST",
      headers: { Authorization: "Bearer user-token" },
      body: form,
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    if (!text.includes('"step":"complete"')) {
      assert.fail(text + "\nmock requests:\n" + requests.join("\n"));
    }
    assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
    for (const step of ["analyze", "source_code", "manual", "convert", "upload", "complete"]) {
      assert.match(text, new RegExp('"step":"' + step + '"'));
    }
    assert.equal(providerCalls, 2);
    assert.equal(uploadedObjects, 3);
    assert.match(generationRecordBody, /"application_id":"11111111-1111-4111-8111-111111111111"/);
    assert.match(generationRecordBody, /"source_code_object_key":"generations\/user-a\//);
    assert.doesNotMatch(text, /test-provider-key/);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => appServer?.close(() => resolve()) ?? resolve());
    await new Promise<void>((resolve) => mock.close(() => resolve()));
  }
});
