import { Router } from "express";
import { z } from "zod";
import { decryptApiKey, encryptApiKey } from "../crypto.js";
import { requireAuth, requestUser } from "../auth.js";
import { supabaseAdmin } from "../db.js";
import { fail, ok } from "../response.js";
import { isAllowedModel, llmConfigSchema, providerSchema } from "../models.js";
import { callLlm } from "../llm.js";

export const llmConfigsRouter = Router();
llmConfigsRouter.use(requireAuth);

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  provider: providerSchema.optional(),
  model: z.string().trim().min(1).optional(),
  apiKey: z.string().trim().min(10).max(500).optional(),
}).strict();

export function publicConfig(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    key_last4: row.key_last4,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

llmConfigsRouter.get("/", async (request, response) => {
  const { data, error } = await supabaseAdmin
    .from("llm_configs")
    .select("id,name,provider,model,key_last4,created_at,updated_at")
    .eq("user_id", requestUser(request).id)
    .order("created_at", { ascending: false });
  if (error) return fail(response, 500, "获取模型配置失败");
  return ok(response, (data || []).map((row) => publicConfig(row as Record<string, unknown>)));
});

llmConfigsRouter.post("/", async (request, response) => {
  const parsed = llmConfigSchema.safeParse(request.body);
  if (!parsed.success) return fail(response, 400, "模型配置参数无效");
  const { name, provider, model, apiKey } = parsed.data;
  if (!isAllowedModel(provider, model)) return fail(response, 400, "提供商或模型不受支持");
  const encrypted = encryptApiKey(apiKey);
  const { data, error } = await supabaseAdmin
    .from("llm_configs")
    .insert({
      user_id: requestUser(request).id,
      name,
      provider,
      model,
      ...encrypted,
    })
    .select("id,name,provider,model,key_last4,created_at,updated_at")
    .single();
  if (error || !data) return fail(response, 500, "保存模型配置失败");
  return ok(response, publicConfig(data as Record<string, unknown>), "模型配置已保存");
});

llmConfigsRouter.put("/:id", async (request, response) => {
  const current = await supabaseAdmin
    .from("llm_configs")
    .select("*")
    .eq("id", request.params.id)
    .eq("user_id", requestUser(request).id)
    .maybeSingle();
  if (current.error || !current.data) return fail(response, 404, "模型配置不存在");

  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success) return fail(response, 400, "模型配置参数无效");
  const body = parsed.data;
  const provider = body.provider || String(current.data.provider);
  const model = body.model || String(current.data.model);
  if (!isAllowedModel(provider, model)) return fail(response, 400, "提供商或模型不受支持");

  const updates: Record<string, unknown> = {
    name: body.name || current.data.name,
    provider,
    model,
    updated_at: new Date().toISOString(),
  };
  if (body.apiKey) Object.assign(updates, encryptApiKey(body.apiKey));
  const result = await supabaseAdmin
    .from("llm_configs")
    .update(updates)
    .eq("id", request.params.id)
    .eq("user_id", requestUser(request).id)
    .select("id,name,provider,model,key_last4,created_at,updated_at")
    .single();
  if (result.error || !result.data) return fail(response, 500, "更新模型配置失败");
  return ok(response, publicConfig(result.data as Record<string, unknown>), "模型配置已更新");
});

llmConfigsRouter.post("/:id/test", async (request, response) => {
  const result = await supabaseAdmin
    .from("llm_configs")
    .select("*")
    .eq("id", request.params.id)
    .eq("user_id", requestUser(request).id)
    .maybeSingle();
  if (result.error || !result.data) return fail(response, 404, "模型配置不存在");
  try {
    const apiKey = decryptApiKey(result.data);
    await callLlm({
      provider: result.data.provider,
      model: result.data.model,
      apiKey,
      messages: [{ role: "user", content: "Respond with the single word OK." }],
      max_tokens: 8,
    });
    return ok(response, { ok: true }, "模型连接正常");
  } catch {
    return fail(response, 502, "模型连接测试失败");
  }
});

llmConfigsRouter.delete("/:id", async (request, response) => {
  const result = await supabaseAdmin
    .from("llm_configs")
    .delete()
    .eq("id", request.params.id)
    .eq("user_id", requestUser(request).id)
    .select("id");
  if (result.error) return fail(response, 500, "删除模型配置失败");
  if (!result.data || result.data.length === 0) return fail(response, 404, "模型配置不存在");
  return ok(response, null, "模型配置已删除");
});
