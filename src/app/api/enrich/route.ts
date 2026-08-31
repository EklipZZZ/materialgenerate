import { NextRequest } from "next/server";
import {
  effectiveApplication,
  getOwnedApplication,
  saveOwnedApplicationEnrichment,
} from "@/server/applications";
import { getOwnedLlmSecret } from "@/server/llm-configs";
import { formToMarkdown, parseEnrichedMarkdown, snapshotFields } from "@/server/form";
import { callLlm } from "@/server/llm";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { enrichRequestSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = enrichRequestSchema;

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "申请参数或模型配置无效");
    const user = await requireUser(request);
    const llmConfig = await getOwnedLlmSecret(user.id, parsed.data.llmConfigId);
    if (!llmConfig) return fail(404, "模型配置不存在，请先在设置中保存配置");
    const application = await getOwnedApplication(parsed.data.applicationId, user.id, request.signal);
    if (!application) return fail(404, "申请不存在");
    const content = await callLlm({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      messages: [
        { role: "system", content: "你是软件著作权申报信息整理助手。" },
        { role: "user", content: [
          "请补全软件著作权登记信息采集表。",
          "只输出 Markdown 表格，不要解释；不要编造真实联系方式、虚构公司证照信息。",
          formToMarkdown(application),
        ].join("\n\n") },
      ],
      temperature: 0.2,
      maxTokens: 5000,
      signal: request.signal,
    });
    const enriched = parseEnrichedMarkdown(content, application);
    const updated = await saveOwnedApplicationEnrichment(
      parsed.data.applicationId,
      user.id,
      snapshotFields(enriched),
      request.signal,
    );
    return updated ? ok(effectiveApplication(updated), "AI 补全完成") : fail(404, "申请不存在");
  } catch (error) {
    return errorResponse(error, "AI 补全失败，请检查模型配置");
  }
}
