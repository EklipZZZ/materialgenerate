import { z } from "zod";
import { getSupabaseAdmin } from "./config";
import { decryptApiKey, encryptApiKey } from "./secrets";
import { type Provider } from "./models";
import { llmConfigWriteSchema } from "./api-contracts.ts";

export { llmConfigWriteSchema } from "./api-contracts.ts";

export interface PublicLlmConfig {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  keyLast4: string;
  createdAt: string;
  updatedAt: string;
}

interface LlmConfigRow {
  id: string;
  user_id: string;
  name: string;
  provider: Provider;
  model: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
  key_last4: string;
  created_at: string;
  updated_at: string;
}

function toPublicConfig(row: LlmConfigRow): PublicLlmConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    keyLast4: row.key_last4,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listOwnedLlmConfigs(userId: string): Promise<PublicLlmConfig[]> {
  const result = await getSupabaseAdmin()
    .from("llm_configs")
    .select("id,user_id,name,provider,model,key_last4,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (result.error) throw new Error("model configuration lookup failed");
  return (result.data || []).map((row) => toPublicConfig(row as LlmConfigRow));
}

export async function getOwnedLlmConfig(userId: string, id: string): Promise<LlmConfigRow | null> {
  const result = await getSupabaseAdmin()
    .from("llm_configs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("model configuration lookup failed");
  return result.data as LlmConfigRow | null;
}

export async function getOwnedLlmSecret(userId: string, id: string) {
  const row = await getOwnedLlmConfig(userId, id);
  if (!row) return null;
  const apiKey = decryptApiKey(row);
  return { provider: row.provider, model: row.model, apiKey };
}

export async function saveOwnedLlmConfig(
  userId: string,
  input: z.infer<typeof llmConfigWriteSchema>,
): Promise<PublicLlmConfig> {
  const encrypted = encryptApiKey(input.apiKey);
  const payload = {
    name: input.name || `${input.provider} 配置`,
    provider: input.provider,
    model: input.model,
    ...encrypted,
    updated_at: new Date().toISOString(),
  };
  const result = input.id
    ? await getSupabaseAdmin()
      .from("llm_configs")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", userId)
      .select("id,user_id,name,provider,model,key_last4,created_at,updated_at")
      .maybeSingle()
    : await getSupabaseAdmin()
      .from("llm_configs")
      .insert({ ...payload, user_id: userId })
      .select("id,user_id,name,provider,model,key_last4,created_at,updated_at")
      .single();
  if (result.error || !result.data) throw new Error(input.id ? "模型配置不存在" : "模型配置保存失败");
  return toPublicConfig(result.data as LlmConfigRow);
}

export async function deleteOwnedLlmConfig(userId: string, id: string): Promise<boolean> {
  const result = await getSupabaseAdmin()
    .from("llm_configs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (result.error) throw new Error("模型配置删除失败");
  return Boolean(result.data?.length);
}
