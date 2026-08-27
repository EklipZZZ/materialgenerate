import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getOwnedApplication } from "@/server/applications";
import { byokSchema } from "@/server/models";
import { assertObjectSize, deleteObjects, downloadBuffer, signedDownloadUrl, uploadBuffer } from "@/server/storage";
import { generateMaterials } from "@/server/generation-pipeline";
import { errorResponse, fail, isAbortError, requireUser } from "@/server/http";
import { getSupabaseAdmin } from "@/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  provider: byokSchema.shape.provider,
  model: byokSchema.shape.model,
  apiKey: byokSchema.shape.apiKey,
  tableTemplate: z.string().max(300_000).optional().default(""),
  skipAnalyze: z.boolean().optional().default(false),
  sourceObjectKey: z.string().trim().max(500).optional(),
  sourceFileName: z.string().trim().max(200).optional(),
});

const activeGenerations = new Set<string>();
const MAX_SOURCE_ARCHIVE_BYTES = 100 * 1024 * 1024;

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100) || "software-copyright";
}

function sourceNameFromKey(key: string): string {
  return key.split("/").pop() || "source.zip";
}

function sseEvent(step: string, message: string, data?: unknown): Uint8Array {
  return new TextEncoder().encode("data: " + JSON.stringify({ step, message, data }) + "\n\n");
}

export async function POST(request: NextRequest) {
  let user;
  let parsed: z.infer<typeof bodySchema>;
  let application;
  try {
    user = await requireUser(request);
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return fail(400, body.error.issues[0]?.message || "生成参数无效");
    const byok = byokSchema.safeParse(body.data);
    if (!byok.success) return fail(400, byok.error.issues[0]?.message || "模型配置无效");
    parsed = body.data;
    application = await getOwnedApplication(parsed.applicationId, user.id, request.signal);
    if (!application) return fail(404, "申请不存在");
    if (parsed.sourceObjectKey && !parsed.sourceObjectKey.startsWith(`incoming/${user.id}/`)) {
      return fail(400, "源码文件无效");
    }
  } catch (error) {
    return errorResponse(error, "生成请求无效");
  }

  const activeKey = user.id + ":" + application.id;
  if (activeGenerations.has(activeKey)) return fail(409, "同一申请已有生成任务正在进行，请等待完成");
  activeGenerations.add(activeKey);

  const abortController = new AbortController();
  const abort = () => abortController.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  let controllerClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (step: string, message: string, data?: unknown) => {
        if (controllerClosed || abortController.signal.aborted) return;
        controller.enqueue(sseEvent(step, message, data));
      };

      void (async () => {
        let stage = "validate";
        const uploadedKeys: string[] = [];
        try {
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
            provider: parsed.provider,
            model: parsed.model,
            apiKey: parsed.apiKey,
            sourceBuffer,
            sourceFileName: parsed.sourceFileName || (sourceKey ? sourceNameFromKey(sourceKey) : undefined),
            requestUrl: request.url,
            signal: abortController.signal,
            emit: (event) => emit(event.step, event.message, event.data),
          });

          emit("upload", "正在上传生成材料…");
          const prefix = `generations/${user.id}/${application.id}/${Date.now()}-${randomUUID()}`;
          const softwareName = safeName(generated.softwareName);
          const sourceObjectKey = `${prefix}/${softwareName}-source-code.docx`;
          const manualObjectKey = `${prefix}/${softwareName}-user-manual.docx`;
          const collectionObjectKey = `${prefix}/${softwareName}-collection-form.md`;
          uploadedKeys.push(sourceObjectKey, manualObjectKey, collectionObjectKey);
          stage = "storage-upload";
          await Promise.all([
            uploadBuffer(sourceObjectKey, generated.sourceDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            uploadBuffer(manualObjectKey, generated.manualDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            uploadBuffer(collectionObjectKey, Buffer.from(generated.collectionMarkdown, "utf8"), "text/markdown; charset=utf-8"),
          ]);

          const [sourceCodeDocx, userManualDocx, collectionFormMarkdown] = await Promise.all([
            signedDownloadUrl(sourceObjectKey),
            signedDownloadUrl(manualObjectKey),
            signedDownloadUrl(collectionObjectKey),
          ]);
          const record = await getSupabaseAdmin().from("generation_records").insert({
            user_id: user.id,
            application_id: application.id,
            file_name: generated.softwareName,
            source_code_summary: generated.sourceSummary,
            source_code_object_key: sourceObjectKey,
            user_manual_object_key: manualObjectKey,
            collection_form_object_key: collectionObjectKey,
            provider: parsed.provider,
            model: parsed.model,
            status: "completed",
          }).select("id").single();
          if (record.error || !record.data) throw new Error("generation record creation failed");
          await getSupabaseAdmin().from("applications").update({
            status: "completed",
            updated_at: new Date().toISOString(),
          }).eq("id", application.id).eq("user_id", user.id);
          emit("complete", "生成完成", {
            sourceCodeDocx,
            userManualDocx,
            collectionFormMarkdown,
            fileName: softwareName,
            recordId: record.data.id,
          });
        } catch (error) {
          if (!isAbortError(error) && !abortController.signal.aborted) {
            console.error("generation pipeline failed at " + stage);
            emit("error", "生成失败，请稍后重试或检查模型配置");
          }
          if (uploadedKeys.length) await deleteObjects(uploadedKeys).catch(() => undefined);
        } finally {
          if (parsed.sourceObjectKey) await deleteObjects([parsed.sourceObjectKey]).catch(() => undefined);
          activeGenerations.delete(activeKey);
          request.signal.removeEventListener("abort", abort);
          if (!controllerClosed) {
            controllerClosed = true;
            controller.close();
          }
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
