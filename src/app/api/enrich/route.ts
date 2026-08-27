import { NextRequest } from "next/server";
import { z } from "zod";
import {
  effectiveApplication,
  getOwnedApplication,
  saveOwnedApplicationEnrichment,
} from "@/server/applications";
import { byokSchema } from "@/server/models";
import { formToMarkdown, parseEnrichedMarkdown, snapshotFields } from "@/server/form";
import { callLlm } from "@/server/llm";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  provider: byokSchema.shape.provider,
  model: byokSchema.shape.model,
  apiKey: byokSchema.shape.apiKey,
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "申请参数或模型配置无效");
    const byok = byokSchema.safeParse(parsed.data);
    if (!byok.success) return fail(400, byok.error.issues[0]?.message || "模型配置无效");
    const user = await requireUser(request);
    const application = await getOwnedApplication(parsed.data.applicationId, user.id, request.signal);
    if (!application) return fail(404, "申请不存在");
    const content = await callLlm({
      provider: byok.data.provider,
      model: byok.data.model,
      apiKey: byok.data.apiKey,
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
