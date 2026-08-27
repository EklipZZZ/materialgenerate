"use client";

import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const STORAGE_BUCKET = "generated-documents";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

interface UploadResponse {
  path: string;
  token: string;
}

export async function uploadSourceFile(file: File): Promise<{ path: string; fileName: string }> {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("源码压缩包不能超过 100 MB");
  }
  const response = await authorizedFetch(apiEndpoint("/api/source-upload"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  const body = await response.json().catch(() => ({})) as { data?: UploadResponse; msg?: string };
  if (!response.ok || !body.data?.path || !body.data.token) throw new Error(body.msg || "创建源码上传授权失败");
  const result = await getSupabaseBrowserClient().storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(body.data.path, body.data.token, file);
  if (result.error) throw new Error("源码压缩包上传失败");
  return { path: body.data.path, fileName: file.name };
}
