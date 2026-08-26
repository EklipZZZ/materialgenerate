"use client";

import { API_URL, requireApiUrl } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";

export type Provider = "openai" | "deepseek";

export interface LlmConfig {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  key_last4: string;
  created_at: string;
  updated_at?: string;
}

interface Envelope<T> {
  code: number;
  msg: string;
  data: T;
}

function endpoint(path: string): string {
  return requireApiUrl(API_URL, "NEXT_PUBLIC_API_URL") + path;
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as Partial<Envelope<T>> & {
    detail?: string;
  };
  if (!response.ok || (typeof body.code === "number" && body.code >= 400)) {
    throw new Error(body.msg || body.detail || "请求失败");
  }
  return body.data as T;
}

export async function listLlmConfigs(): Promise<LlmConfig[]> {
  return unwrap<LlmConfig[]>(await authorizedFetch(endpoint("/api/llm-configs")));
}

export async function createLlmConfig(input: {
  name: string;
  provider: Provider;
  model: string;
  apiKey: string;
}): Promise<LlmConfig> {
  return unwrap<LlmConfig>(
    await authorizedFetch(endpoint("/api/llm-configs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateLlmConfig(
  id: string,
  input: { name?: string; provider?: Provider; model?: string; apiKey?: string },
): Promise<LlmConfig> {
  return unwrap<LlmConfig>(
    await authorizedFetch(endpoint("/api/llm-configs/" + encodeURIComponent(id)), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function testLlmConfig(id: string): Promise<void> {
  await unwrap(
    await authorizedFetch(endpoint("/api/llm-configs/" + encodeURIComponent(id) + "/test"), {
      method: "POST",
    }),
  );
}

export async function deleteLlmConfig(id: string): Promise<void> {
  await unwrap(
    await authorizedFetch(endpoint("/api/llm-configs/" + encodeURIComponent(id)), {
      method: "DELETE",
    }),
  );
}
