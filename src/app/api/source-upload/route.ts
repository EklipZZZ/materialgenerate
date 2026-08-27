import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createSignedUpload } from "@/server/storage";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const bodySchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\.\.+/g, "_").trim().slice(0, 120) || "source.zip";
}

function supportedArchive(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".zip") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz");
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, "源码压缩包参数无效");
    const fileName = safeFileName(parsed.data.fileName);
    if (!supportedArchive(fileName)) return fail(400, "仅支持 ZIP、TAR.GZ 或 TGZ 源代码压缩包");
    const path = `incoming/${user.id}/${randomUUID()}-${fileName}`;
    const signed = await createSignedUpload(path);
    return ok({ ...signed, contentType: parsed.data.contentType || "application/octet-stream" });
  } catch (error) {
    return errorResponse(error, "创建源码上传授权失败");
  }
}
