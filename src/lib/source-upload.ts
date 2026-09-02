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

export interface SavedSourceArchive {
  id: string;
  applicationId: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  reviewStatus: "pending" | "confirmed" | "skipped";
  reviewedApplicationUpdatedAt: string | null;
  reviewedSourceUpdatedAt: string | null;
  reviewedAt: string | null;
}

async function responseData<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as { data?: T; msg?: string };
  if (!response.ok || body.data === undefined) throw new Error(body.msg || fallback);
  return body.data;
}

export async function getSavedSourceArchive(applicationId: string): Promise<SavedSourceArchive | null> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/source-archive`));
  return responseData<SavedSourceArchive | null>(response, "获取源码压缩包失败");
}

export async function uploadSavedSourceArchive(applicationId: string, file: File): Promise<SavedSourceArchive> {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new Error("源码压缩包不能超过 100 MB");
  const endpoint = `/api/applications/${encodeURIComponent(applicationId)}/source-archive`;
  const authorizationResponse = await authorizedFetch(apiEndpoint(`${endpoint}/upload-url`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  const authorization = await responseData<UploadResponse>(authorizationResponse, "创建源码上传授权失败");
  const upload = await getSupabaseBrowserClient().storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(authorization.path, authorization.token, file);
  if (upload.error) throw new Error("源码压缩包上传失败");

  const completeResponse = await authorizedFetch(apiEndpoint(`${endpoint}/complete`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: authorization.path,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  return responseData<SavedSourceArchive>(completeResponse, "确认源码压缩包失败");
}

export async function deleteSavedSourceArchive(applicationId: string): Promise<void> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/source-archive`), {
    method: "DELETE",
  });
  await responseData<null>(response, "删除源码压缩包失败");
}

export async function reviewSavedSourceArchive(
  applicationId: string,
  input: { decision: "confirmed" | "skipped"; applicationUpdatedAt: string; sourceUpdatedAt: string },
): Promise<SavedSourceArchive> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/source-archive/review`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return responseData<SavedSourceArchive>(response, "保存源码核对状态失败");
}
