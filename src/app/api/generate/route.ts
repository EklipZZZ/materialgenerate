import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { effectiveApplication, getOwnedApplication } from "@/server/applications";
import { getOwnedLlmSecret } from "@/server/llm-configs";
import { createGenerationJob, recordJobEvent, updateGenerationJob } from "@/server/generation-jobs";
import { assertObjectSize, deleteObjects, downloadBuffer, signedDownloadUrl, uploadBuffer } from "@/server/storage";
import { generateMaterials } from "@/server/generation-pipeline";
import { errorResponse, fail, isAbortError, requireUser } from "@/server/http";
import { getSupabaseAdmin } from "@/server/config";
import { recordGeneratedMaterials } from "@/server/materials";
import { generateRequestSchema } from "@/server/api-contracts";
import { validateCopyrightTextFields } from "@/lib/copyright-constraints";
import { getLlmFailureInfo } from "@/server/llm";
import { DocumentConversionError } from "@/server/converter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby limits Serverless Functions to 300 seconds. Keep a soft
// deadline below that limit so the job can persist a useful failure state.
export const maxDuration = 300;

const GENERATION_SOFT_TIMEOUT_MS = 270_000;

const bodySchema = generateRequestSchema;

const MAX_SOURCE_ARCHIVE_BYTES = 100 * 1024 * 1024;

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100) || "software-copyright";
}

function sourceNameFromKey(key: string): string {
  return key.split("/").pop() || "source.zip";
}

function progressForStep(step: string): number {
  return {
    queued: 0,
    init: 5,
    analyze: 15,
    source_code: 35,
    manual: 60,
    convert: 82,
    upload: 94,
    "source-download": 5,
    "storage-upload": 94,
    complete: 100,
  }[step] ?? 10;
}

function stageLabel(stage: string): string {
  return {
    queued: "排队",
    init: "初始化",
    analyze: "采集表分析",
    source_code: "源代码处理",
    manual: "用户手册生成",
    convert: "文档转换",
    upload: "结果保存",
    "source-download": "源码读取",
    "storage-upload": "文件上传",
  }[stage] || "生成";
}

function operationLabel(operation?: string): string | undefined {
  if (!operation) return undefined;
  const [group, name] = operation.split("/");
  const groupLabel = group === "manual" ? "用户手册" : group === "source-code" ? "源代码" : group === "analyze" ? "采集表" : group;
  const nameLabels: Record<string, string> = {
    overview: "软件概况",
    functions: "软件功能",
    environment: "运行环境与安装",
    operations: "操作说明",
    tech_test: "技术特点与测试",
  };
  return name ? `${groupLabel}·${nameLabels[name] || name}` : groupLabel;
}

function sseEvent(step: string, message: string, data?: unknown): Uint8Array {
  return new TextEncoder().encode("data: " + JSON.stringify({ step, message, data }) + "\n\n");
}

export async function POST(request: NextRequest) {
  let user;
  let parsed: z.infer<typeof bodySchema>;
  let application;
  let llmConfig;
  try {
    user = await requireUser(request);
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return fail(400, body.error.issues[0]?.message || "生成参数无效");
    parsed = body.data;
    llmConfig = await getOwnedLlmSecret(user.id, parsed.llmConfigId);
    if (!llmConfig) return fail(404, "模型配置不存在，请先在设置中保存配置");
    application = await getOwnedApplication(parsed.applicationId, user.id, request.signal);
    if (!application) return fail(404, "申请不存在");
    if (parsed.sourceObjectKey && !parsed.sourceObjectKey.startsWith(`incoming/${user.id}/`)) {
      return fail(400, "源码文件无效");
    }
    if (parsed.skipAnalyze) {
      const effective = effectiveApplication(application).effective_form as Record<string, unknown>;
      const validationErrors = validateCopyrightTextFields(effective, { requireMainFunctions: true });
      if (validationErrors.length) {
        if (parsed.sourceObjectKey) await deleteObjects([parsed.sourceObjectKey]).catch(() => undefined);
        return fail(400, `生成前请修正：${validationErrors[0]}`);
      }
    }
  } catch (error) {
    return errorResponse(error, "生成请求无效");
  }

  let job;
  try {
    job = await createGenerationJob({
      userId: user.id,
      applicationId: application.id,
      provider: llmConfig.provider,
      model: llmConfig.model,
    });
  } catch (error) {
    if (parsed.sourceObjectKey) await deleteObjects([parsed.sourceObjectKey]).catch(() => undefined);
    return errorResponse(error, "创建生成任务失败");
  }
  const jobId = job.id;
  const abortController = new AbortController();
  let deadlineExceeded = false;
  const generationDeadline = setTimeout(() => {
    deadlineExceeded = true;
    abortController.abort();
  }, GENERATION_SOFT_TIMEOUT_MS);
  const abort = () => abortController.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  let controllerClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastPersistedAt = 0;
      let lastPersistedSignature = "";
      const pendingPersistence: Promise<void>[] = [];
      let terminal = false;
      const emit = (step: string, message: string, data?: unknown) => {
        if (terminal) return;
        if (!controllerClosed && !abortController.signal.aborted) {
          controller.enqueue(sseEvent(step, message, data));
        }
        const progress = progressForStep(step);
        const signature = step + "\n" + message;
        const now = Date.now();
        if (signature !== lastPersistedSignature || now - lastPersistedAt > 1_000) {
          lastPersistedAt = now;
          lastPersistedSignature = signature;
          pendingPersistence.push(Promise.all([
            recordJobEvent({ jobId, userId: user.id, step, message, progress }),
            updateGenerationJob(jobId, user.id, {
              current_step: step,
              progress,
              status: step === "complete" ? "completed" : "running",
            }),
          ]).then(() => undefined).catch(() => undefined));
        }
      };

      void (async () => {
        let stage = "queued";
        const uploadedKeys: string[] = [];
        let generationRecordId: string | null = null;
        try {
          await updateGenerationJob(jobId, user.id, {
            status: "running",
            current_step: "init",
            progress: 1,
            started_at: new Date().toISOString(),
          });
          emit("init", "生成任务已启动");
          await getSupabaseAdmin().from("applications").update({
            status: "generating",
            updated_at: new Date().toISOString(),
          }).eq("id", application.id).eq("user_id", user.id);

          let sourceBuffer: Buffer | undefined;
          const sourceKey = parsed.sourceObjectKey;
          if (sourceKey) {
            stage = "source-download";
            emit("init", "正在读取已上传的源代码压缩包…");
            await assertObjectSize(sourceKey, MAX_SOURCE_ARCHIVE_BYTES);
            sourceBuffer = await downloadBuffer(sourceKey);
          }
          stage = "generation";
          const generated = await generateMaterials({
            application,
            tableTemplate: parsed.tableTemplate,
            skipAnalyze: parsed.skipAnalyze,
            provider: llmConfig.provider,
            model: llmConfig.model,
            apiKey: llmConfig.apiKey,
            sourceBuffer,
            sourceFileName: parsed.sourceFileName || (sourceKey ? sourceNameFromKey(sourceKey) : undefined),
            requestUrl: request.url,
            signal: abortController.signal,
            emit: (event) => {
              if (event.step !== "complete") stage = event.step;
              emit(event.step, event.message, event.data);
            },
          });

          emit("upload", "正在上传 DOCX、PDF 和摘要材料…");
          const prefix = `generations/${user.id}/${application.id}/${Date.now()}-${randomUUID()}`;
          const softwareName = safeName(generated.softwareName);
          const sourceObjectKey = `${prefix}/${softwareName}-source-code.docx`;
          const sourcePdfObjectKey = `${prefix}/${softwareName}-source-code.pdf`;
          const manualObjectKey = `${prefix}/${softwareName}-user-manual.docx`;
          const manualPdfObjectKey = `${prefix}/${softwareName}-user-manual.pdf`;
          const summaryPdfObjectKey = `${prefix}/${softwareName}-application-summary.pdf`;
          const collectionObjectKey = `${prefix}/${softwareName}-collection-form.md`;
          uploadedKeys.push(
            sourceObjectKey,
            sourcePdfObjectKey,
            manualObjectKey,
            manualPdfObjectKey,
            summaryPdfObjectKey,
            collectionObjectKey,
          );
          stage = "storage-upload";
          await Promise.all([
            uploadBuffer(sourceObjectKey, generated.sourceDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            uploadBuffer(sourcePdfObjectKey, generated.sourcePdf, "application/pdf"),
            uploadBuffer(manualObjectKey, generated.manualDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            uploadBuffer(manualPdfObjectKey, generated.manualPdf, "application/pdf"),
            uploadBuffer(summaryPdfObjectKey, generated.summaryPdf, "application/pdf"),
            uploadBuffer(collectionObjectKey, Buffer.from(generated.collectionMarkdown, "utf8"), "text/markdown; charset=utf-8"),
          ]);

          const [sourceCodeDocx, sourceCodePdf, userManualDocx, userManualPdf, applicationSummaryPdf, collectionFormMarkdown] = await Promise.all([
            signedDownloadUrl(sourceObjectKey),
            signedDownloadUrl(sourcePdfObjectKey),
            signedDownloadUrl(manualObjectKey),
            signedDownloadUrl(manualPdfObjectKey),
            signedDownloadUrl(summaryPdfObjectKey),
            signedDownloadUrl(collectionObjectKey),
          ]);
          const record = await getSupabaseAdmin().from("generation_records").insert({
            user_id: user.id,
            application_id: application.id,
            file_name: generated.softwareName,
            source_code_summary: generated.sourceSummary,
            source_code_object_key: sourceObjectKey,
            source_code_pdf_object_key: sourcePdfObjectKey,
            user_manual_object_key: manualObjectKey,
            user_manual_pdf_object_key: manualPdfObjectKey,
            application_summary_pdf_object_key: summaryPdfObjectKey,
            collection_form_object_key: collectionObjectKey,
            job_id: jobId,
            provider: llmConfig.provider,
            model: llmConfig.model,
            status: "completed",
          }).select("id").single();
          if (record.error || !record.data) throw new Error("generation record creation failed");
          const createdGenerationRecordId = record.data.id;
          generationRecordId = createdGenerationRecordId;
          await recordGeneratedMaterials({
            applicationId: application.id,
            userId: user.id,
            generationRecordId: createdGenerationRecordId,
            developmentMethod: String(application.development_method || "independent"),
            files: [
              { kind: "source_code_docx", fileName: `${softwareName}-source-code.docx`, objectKey: sourceObjectKey, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: generated.sourceDocx.length },
              { kind: "source_code_pdf", fileName: `${softwareName}-source-code.pdf`, objectKey: sourcePdfObjectKey, mimeType: "application/pdf", sizeBytes: generated.sourcePdf.length },
              { kind: "user_manual_docx", fileName: `${softwareName}-user-manual.docx`, objectKey: manualObjectKey, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: generated.manualDocx.length },
              { kind: "user_manual_pdf", fileName: `${softwareName}-user-manual.pdf`, objectKey: manualPdfObjectKey, mimeType: "application/pdf", sizeBytes: generated.manualPdf.length },
              { kind: "application_summary_pdf", fileName: `${softwareName}-application-summary.pdf`, objectKey: summaryPdfObjectKey, mimeType: "application/pdf", sizeBytes: generated.summaryPdf.length },
            ],
          });
          const applicationUpdate = await getSupabaseAdmin().from("applications").update({
            status: "completed",
            updated_at: new Date().toISOString(),
          }).eq("id", application.id).eq("user_id", user.id);
          if (applicationUpdate.error) throw new Error("application status update failed");
          await updateGenerationJob(jobId, user.id, {
            status: "completed",
            current_step: "complete",
            progress: 100,
            completed_at: new Date().toISOString(),
          });
          emit("complete", "生成完成", {
            jobId,
            sourceCodeDocx,
            sourceCodePdf,
            userManualDocx,
            userManualPdf,
            applicationSummaryPdf,
            collectionFormMarkdown,
            fileName: softwareName,
            recordId: createdGenerationRecordId,
            pdfWarnings: generated.pdfWarnings,
          });
          terminal = true;
        } catch (error) {
          const cancelled = !deadlineExceeded && (isAbortError(error) || abortController.signal.aborted);
          const status = cancelled ? "cancelled" : "failed";
          const failure = getLlmFailureInfo(error);
          const operation = operationLabel(failure?.operation);
          const documentFailure = error instanceof DocumentConversionError ? error.message : null;
          const message = cancelled
            ? "生成任务已取消"
            : deadlineExceeded
              ? "生成超过平台运行时限，任务已自动结束，请稍后重试"
              : documentFailure
                ? `生成失败（文档转换）：${documentFailure}`
                : failure
                  ? `生成失败${operation ? `（${operation}）` : ""}：${failure.userMessage}`
                  : `生成在${stageLabel(stage)}阶段失败，请稍后重试`;
          const failureMetadata = deadlineExceeded
            ? {
              failure_kind: "generation_timeout",
              operation: null,
              retryable: true,
            }
            : documentFailure
              ? {
                failure_kind: "document_conversion",
                operation: "convert",
                retryable: true,
              }
              : failure
            ? {
              failure_kind: failure.kind,
              provider: failure.provider,
              model: failure.model,
              operation: failure.operation || null,
              http_status: failure.status || null,
              upstream_code: failure.code || null,
              upstream_request_id: failure.requestId || null,
              retryable: failure.retryable,
            }
            : {
              failure_kind: cancelled ? "cancelled" : "pipeline",
              operation: null,
              retryable: false,
            };
          const failureKind = failure?.kind || (deadlineExceeded ? "generation_timeout" : documentFailure ? "document_conversion" : undefined);
          const retryable = failure?.retryable ?? (deadlineExceeded || Boolean(documentFailure));
          terminal = true;
          console.error("generation pipeline failed", { stage, ...failureMetadata });
          await Promise.all(pendingPersistence);
          await updateGenerationJob(jobId, user.id, {
            status,
            current_step: stage,
            progress: progressForStep(stage),
            error_message: message,
            completed_at: new Date().toISOString(),
          }).catch(() => undefined);
          await recordJobEvent({
            jobId,
            userId: user.id,
            step: stage,
            message,
            progress: progressForStep(stage),
            metadata: failureMetadata,
          }).catch(() => undefined);
          if (generationRecordId) {
            await getSupabaseAdmin().from("application_materials").delete().eq("generation_record_id", generationRecordId).eq("user_id", user.id);
            await getSupabaseAdmin().from("generation_records").delete().eq("id", generationRecordId).eq("user_id", user.id);
          }
          if (!cancelled && !controllerClosed) {
            controller.enqueue(sseEvent("error", message, {
              jobId,
              stage,
              operation: failure?.operation || (documentFailure ? "convert" : undefined),
              errorKind: failureKind,
              retryable,
            }));
          }
          if (uploadedKeys.length) await deleteObjects(uploadedKeys).catch(() => undefined);
          await getSupabaseAdmin().from("applications").update({
            status: "draft",
            updated_at: new Date().toISOString(),
          }).eq("id", application.id).eq("user_id", user.id);
        } finally {
          await Promise.all(pendingPersistence);
          if (parsed.sourceObjectKey) await deleteObjects([parsed.sourceObjectKey]).catch(() => undefined);
          request.signal.removeEventListener("abort", abort);
          if (!controllerClosed) {
            controllerClosed = true;
            controller.close();
          }
          clearTimeout(generationDeadline);
        }
      })();
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
