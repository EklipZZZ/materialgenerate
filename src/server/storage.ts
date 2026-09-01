import { getServerEnv, getSupabaseAdmin } from "./config";

function bucket() {
  return getSupabaseAdmin().storage.from(getServerEnv().storageBucket);
}

type StorageErrorLike = {
  name?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function storageFailure(operation: string, cause?: unknown): Error {
  const error = cause && typeof cause === "object" ? cause as StorageErrorLike : undefined;
  const details = {
    name: typeof error?.name === "string" ? error.name : undefined,
    message: typeof error?.message === "string" ? error.message.slice(0, 300) : undefined,
    status: typeof error?.status === "number" || typeof error?.status === "string" ? error.status : undefined,
    statusCode: typeof error?.statusCode === "number" || typeof error?.statusCode === "string" ? error.statusCode : undefined,
  };
  console.error("storage " + operation + " failed", details);
  return new Error("storage operation failed");
}

export async function assertObjectSize(path: string, maxBytes: number): Promise<void> {
  const result = await bucket().info(path);
  if (result.error || !result.data) throw storageFailure("object info", result.error);
  const size = Number((result.data as { size?: unknown }).size);
  if (!Number.isFinite(size) || size < 0) throw storageFailure("object size", result.error);
  if (size > maxBytes) throw new Error("source archive is too large");
}

export async function createSignedUpload(path: string) {
  const result = await bucket().createSignedUploadUrl(path);
  if (result.error || !result.data?.token) throw storageFailure("signed upload", result.error);
  return { path: result.data.path, token: result.data.token };
}

export async function uploadBuffer(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const result = await bucket().upload(path, body, { contentType, upsert: false });
  if (result.error) throw storageFailure("upload", result.error);
}

export async function downloadBuffer(path: string): Promise<Buffer> {
  const result = await bucket().download(path);
  if (result.error || !result.data) throw storageFailure("download", result.error);
  return Buffer.from(await result.data.arrayBuffer());
}

export async function signedDownloadUrl(path: string): Promise<string> {
  const result = await bucket().createSignedUrl(path, 900);
  if (result.error || !result.data?.signedUrl) throw storageFailure("signed URL", result.error);
  return result.data.signedUrl;
}

export async function deleteObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const result = await bucket().remove(paths);
  if (result.error) throw storageFailure("delete", result.error);
}
