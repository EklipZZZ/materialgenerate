import { Router } from "express";
import { z } from "zod";
import { effectiveApplication, getOwnedApplication, saveOwnedApplicationEnrichment } from "../applications.js";
import { requireAuth, requestUser } from "../auth.js";
import { decryptApiKey } from "../crypto.js";
import { supabaseAdmin } from "../db.js";
import { callLlm } from "../llm.js";
import { formToMarkdown, parseEnrichedMarkdown, snapshotFields } from "../form.js";
import { fail, ok } from "../response.js";

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  configId: z.string().uuid(),
});

interface LlmConfigRow {
  provider: "openai" | "deepseek";
  model: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
}

export const enrichRouter = Router();
enrichRouter.use(requireAuth);

enrichRouter.post("/", async (request, response) => {
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) return fail(response, 400, "申请参数无效");
  const userId = requestUser(request).id;

  let application: Record<string, unknown> | null;
  let configResult: { data: LlmConfigRow | null; error: unknown };
  try {
    const [applicationData, configData] = await Promise.all([
      getOwnedApplication(parsed.data.applicationId, userId),
      supabaseAdmin
        .from("llm_configs")
        .select("*")
        .eq("id", parsed.data.configId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    application = applicationData;
    configResult = configData;
  } catch {
    return fail(response, 502, "申请服务暂时不可用");
  }

  if (!application) return fail(response, 404, "申请不存在");
  if (configResult.error || !configResult.data) return fail(response, 404, "模型配置不存在");

  try {
    const apiKey = decryptApiKey(configResult.data);
    const prompt = [
      "请补全软件著作权登记信息采集表。",
      "只输出 Markdown 表格，不要解释；不要编造真实联系方式、虚构公司证照信息。",
      formToMarkdown(application),
    ].join("\n\n");
    const content = await callLlm({
      provider: configResult.data.provider,
      model: configResult.data.model,
      apiKey,
      messages: [
        { role: "system", content: "你是软件著作权申报信息整理助手。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 5000,
    });
    if (typeof content !== "string") throw new Error("invalid llm response");
    const enriched = parseEnrichedMarkdown(content, application);
    const updated = await saveOwnedApplicationEnrichment(
      parsed.data.applicationId,
      userId,
      snapshotFields(enriched),
    );
    if (!updated) return fail(response, 404, "申请不存在");
    return ok(response, effectiveApplication(updated), "AI 补全完成");
  } catch {
    return fail(response, 502, "AI 补全失败，请检查模型配置");
  }
});
