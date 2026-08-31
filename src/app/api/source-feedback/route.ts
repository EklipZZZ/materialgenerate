import { NextRequest } from "next/server";
import { effectiveApplication, getOwnedApplication } from "@/server/applications";
import { getOwnedLlmSecret } from "@/server/llm-configs";
import { assertObjectSize, deleteObjects, downloadBuffer } from "@/server/storage";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { sourceFeedbackRequestSchema } from "@/server/api-contracts";
import { generateSourceFeedback } from "@/server/source-feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SOURCE_ARCHIVE_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let cleanupKey: string | null = null;
  try {
    const user = await requireUser(request);
    const parsed = sourceFeedbackRequestSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "源码反馈参数无效");
    if (!parsed.data.sourceObjectKey.startsWith(`incoming/${user.id}/`)) return fail(400, "源码文件无效");
    cleanupKey = parsed.data.sourceObjectKey;

    const [llmConfig, application] = await Promise.all([
      getOwnedLlmSecret(user.id, parsed.data.llmConfigId),
      getOwnedApplication(parsed.data.applicationId, user.id, request.signal),
    ]);
    if (!llmConfig) return fail(404, "模型配置不存在，请先在设置中保存配置");
    if (!application) return fail(404, "申请不存在");

    await assertObjectSize(parsed.data.sourceObjectKey, MAX_SOURCE_ARCHIVE_BYTES);
    const sourceBuffer = await downloadBuffer(parsed.data.sourceObjectKey);
    const effective = effectiveApplication(application).effective_form as Record<string, unknown>;
    const result = await generateSourceFeedback({
      application: effective,
      sourceBuffer,
      sourceFileName: parsed.data.sourceFileName,
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      signal: request.signal,
    });
    return ok(result, result.suggestions.length ? "源码反馈已生成，请确认后应用" : "源码分析完成，暂未发现可应用的修正建议");
  } catch (error) {
    return errorResponse(error, "源码反馈失败，请检查压缩包和模型配置");
  } finally {
    if (cleanupKey) await deleteObjects([cleanupKey]).catch(() => undefined);
  }
}
