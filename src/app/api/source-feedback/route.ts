import { NextRequest } from "next/server";
import { effectiveApplication, getOwnedApplication } from "@/server/applications";
import { getOwnedLlmSecret } from "@/server/llm-configs";
import { assertObjectSize, downloadBuffer } from "@/server/storage";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { sourceFeedbackRequestSchema } from "@/server/api-contracts";
import { generateSourceFeedback } from "@/server/source-feedback";
import { getOwnedSourceArchive } from "@/server/source-archives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SOURCE_ARCHIVE_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const parsed = sourceFeedbackRequestSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "源码反馈参数无效");

    const [llmConfig, application, sourceArchive] = await Promise.all([
      getOwnedLlmSecret(user.id, parsed.data.llmConfigId),
      getOwnedApplication(parsed.data.applicationId, user.id, request.signal),
      getOwnedSourceArchive(parsed.data.applicationId, user.id),
    ]);
    if (!llmConfig) return fail(404, "模型配置不存在，请先在设置中保存配置");
    if (!application) return fail(404, "申请不存在");
    if (!sourceArchive) return fail(404, "请先在申请编辑页上传源码压缩包");

    await assertObjectSize(sourceArchive.objectKey, MAX_SOURCE_ARCHIVE_BYTES);
    const sourceBuffer = await downloadBuffer(sourceArchive.objectKey);
    const effective = effectiveApplication(application).effective_form as Record<string, unknown>;
    const result = await generateSourceFeedback({
      application: effective,
      sourceBuffer,
      sourceFileName: sourceArchive.archive.fileName,
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      signal: request.signal,
    });
    return ok(result, result.suggestions.length ? "源码反馈已生成，请确认后应用" : "源码分析完成，暂未发现可应用的修正建议");
  } catch (error) {
    return errorResponse(error, "源码反馈失败，请检查压缩包和模型配置");
  }
}
