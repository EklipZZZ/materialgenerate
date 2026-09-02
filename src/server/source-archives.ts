import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sourceArchiveCompleteSchema, sourceArchiveReviewSchema, sourceArchiveUploadSchema } from "./api-contracts.ts";
import { getSupabaseAdmin } from "./config";
import { ApiError } from "./http";
import { assertObjectSize, createSignedUpload, deleteObjects } from "./storage";

const MAX_SOURCE_ARCHIVE_BYTES = 100 * 1024 * 1024;

export type SourceReviewStatus = "pending" | "confirmed" | "skipped";

export interface SourceArchive {
  id: string;
  applicationId: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  reviewStatus: SourceReviewStatus;
  reviewedApplicationUpdatedAt: string | null;
  reviewedSourceUpdatedAt: string | null;
  reviewedAt: string | null;
}

function archiveExtension(fileName: string): ".zip" | ".tar.gz" | ".tgz" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tar.gz")) return ".tar.gz";
  if (lower.endsWith(".zip")) return ".zip";
  if (lower.endsWith(".tgz")) return ".tgz";
  return null;
}

function displayFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\.\.+/g, "_").trim().slice(0, 200) || "source.zip";
}

function mapArchive(row: Record<string, unknown>): SourceArchive {
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    fileName: String(row.file_name),
    contentType: String(row.mime_type || "application/octet-stream"),
    size: Number(row.size_bytes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    reviewStatus: row.review_status === "confirmed" || row.review_status === "skipped" ? row.review_status : "pending",
    reviewedApplicationUpdatedAt: typeof row.reviewed_application_updated_at === "string" ? row.reviewed_application_updated_at : null,
    reviewedSourceUpdatedAt: typeof row.reviewed_source_updated_at === "string" ? row.reviewed_source_updated_at : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
  };
}

export async function getOwnedSourceArchive(applicationId: string, userId: string) {
  const result = await getSupabaseAdmin().from("application_source_archives")
    .select("*")
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("源码压缩包查询失败");
  return result.data ? { archive: mapArchive(result.data as Record<string, unknown>), objectKey: String(result.data.object_key) } : null;
}

export async function createSourceArchiveUploadAuthorization(
  applicationId: string,
  userId: string,
  input: z.infer<typeof sourceArchiveUploadSchema>,
) {
  const extension = archiveExtension(input.fileName);
  if (!extension) throw new Error("仅支持 ZIP、TAR.GZ 或 TGZ 源代码压缩包");
  const path = `incoming/${userId}/${applicationId}/${randomUUID()}${extension}`;
  const signed = await createSignedUpload(path);
  return { ...signed, contentType: input.contentType || "application/octet-stream" };
}

export async function completeSourceArchiveUpload(
  applicationId: string,
  userId: string,
  input: z.infer<typeof sourceArchiveCompleteSchema>,
) {
  const expectedPrefix = `incoming/${userId}/${applicationId}/`;
  if (!input.path.startsWith(expectedPrefix) || !archiveExtension(input.path)) throw new Error("源码压缩包路径无效");
  await assertObjectSize(input.path, MAX_SOURCE_ARCHIVE_BYTES);

  const previous = await getOwnedSourceArchive(applicationId, userId);
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin().from("application_source_archives").upsert({
    user_id: userId,
    application_id: applicationId,
    object_key: input.path,
    file_name: displayFileName(input.fileName),
    mime_type: input.contentType || "application/octet-stream",
    size_bytes: input.size,
    review_status: "pending",
    reviewed_application_updated_at: null,
    reviewed_source_updated_at: null,
    reviewed_at: null,
    updated_at: now,
  }, { onConflict: "application_id" }).select("*").single();
  if (result.error || !result.data) {
    await deleteObjects([input.path]).catch(() => undefined);
    throw new Error("源码压缩包绑定失败");
  }
  if (previous?.objectKey && previous.objectKey !== input.path) {
    await deleteObjects([previous.objectKey]).catch((error) => console.warn("old source archive cleanup failed", { message: error instanceof Error ? error.message : "unknown" }));
  }
  return mapArchive(result.data as Record<string, unknown>);
}

export function isSourceArchiveReviewCurrent(archive: SourceArchive, applicationUpdatedAt: string | undefined): boolean {
  return Boolean(applicationUpdatedAt
    && archive.reviewStatus !== "pending"
    && archive.reviewedApplicationUpdatedAt === applicationUpdatedAt
    && archive.reviewedSourceUpdatedAt === archive.updatedAt);
}

export async function invalidateOwnedSourceArchiveReview(applicationId: string, userId: string): Promise<void> {
  const result = await getSupabaseAdmin().from("application_source_archives")
    .update({
      review_status: "pending",
      reviewed_application_updated_at: null,
      reviewed_source_updated_at: null,
      reviewed_at: null,
    })
    .eq("application_id", applicationId)
    .eq("user_id", userId);
  if (result.error) throw new Error("源码核对状态失效处理失败");
}

export async function reviewOwnedSourceArchive(
  applicationId: string,
  userId: string,
  input: z.infer<typeof sourceArchiveReviewSchema>,
): Promise<SourceArchive> {
  const current = await getOwnedSourceArchive(applicationId, userId);
  if (!current) throw new ApiError(404, "请先上传源码压缩包");

  const application = await getSupabaseAdmin().from("applications")
    .select("updated_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (application.error) throw new Error("申请版本查询失败");
  if (!application.data) throw new ApiError(404, "申请不存在");
  if (String(application.data.updated_at) !== input.applicationUpdatedAt || current.archive.updatedAt !== input.sourceUpdatedAt) {
    throw new ApiError(409, "申请或源码已变化，请重新核对");
  }

  const now = new Date().toISOString();
  const result = await getSupabaseAdmin().from("application_source_archives")
    .update({
      review_status: input.decision,
      reviewed_application_updated_at: input.applicationUpdatedAt,
      reviewed_source_updated_at: input.sourceUpdatedAt,
      reviewed_at: now,
      updated_at: input.sourceUpdatedAt,
    })
    .eq("id", current.archive.id)
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .eq("updated_at", input.sourceUpdatedAt)
    .select("*")
    .single();
  if (result.error || !result.data) throw new ApiError(409, "源码已变化，请重新核对");
  return mapArchive(result.data as Record<string, unknown>);
}

export async function clearOwnedSourceArchive(applicationId: string, userId: string): Promise<boolean> {
  const current = await getOwnedSourceArchive(applicationId, userId);
  if (!current) return false;
  const result = await getSupabaseAdmin().from("application_source_archives")
    .delete()
    .eq("application_id", applicationId)
    .eq("user_id", userId);
  if (result.error) throw new Error("源码压缩包记录删除失败");
  await deleteObjects([current.objectKey]).catch((error) => console.warn("source archive cleanup failed", { message: error instanceof Error ? error.message : "unknown" }));
  return true;
}
