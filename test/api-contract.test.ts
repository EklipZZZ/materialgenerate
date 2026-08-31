import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenApiDocument } from "../src/server/openapi.ts";

function containsWriteOnlyApiKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsWriteOnlyApiKey);
  const object = value as Record<string, unknown>;
  if (object.apiKey && typeof object.apiKey === "object") {
    const apiKeySchema = object.apiKey as Record<string, unknown>;
    if (apiKeySchema.writeOnly === true) return true;
  }
  return Object.values(object).some(containsWriteOnlyApiKey);
}

test("OpenAPI document describes the softreg contract", () => {
  const document = buildOpenApiDocument() as unknown as {
    openapi: string;
    security?: unknown;
    paths: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, unknown>; securitySchemes?: Record<string, unknown> };
  };

  assert.equal(document.openapi, "3.1.0");
  assert.deepEqual(document.security, [{ bearerAuth: [] }]);
  assert.ok(document.components?.securitySchemes?.bearerAuth);
  assert.deepEqual(document.paths["/api/health"]?.get && (document.paths["/api/health"].get as Record<string, unknown>).security, []);
  assert.ok(document.paths["/api/generate"]?.post);
  assert.ok(document.paths["/api/applications/{id}/materials/upload-url"]?.post);
  assert.ok(document.paths["/api/llm-configs/{id}/test"]?.post);

  const generationPost = document.paths["/api/generate"].post as Record<string, unknown>;
  const generationResponses = generationPost.responses as Record<string, unknown>;
  const streamResponse = generationResponses["200"] as Record<string, unknown>;
  const streamContent = (streamResponse.content as Record<string, unknown>)["text/event-stream"];
  assert.ok(streamContent);

  const serialized = JSON.stringify(document);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.equal(serialized.includes("auth_tag"), false);
  assert.equal(serialized.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(containsWriteOnlyApiKey(document), true);
});
