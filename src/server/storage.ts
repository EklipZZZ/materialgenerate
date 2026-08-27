import { getServerEnv, getSupabaseAdmin } from "./config";

function bucket() {
  return getSupabaseAdmin().storage.from(getServerEnv().storageBucket);
}

function storageFailure(operation: string): Error {
  console.error("storage " + operation + " failed");
  return new Error("storage operation failed");
}

export async function assertObjectSize(path: string, maxBytes: number): Promise<void> {
  const result = await bucket().info(path);
  if (result.error || !result.data) throw storageFailure("object info");
  const size = Number((result.data as { size?: unknown }).size);
  if (!Number.isFinite(size) || size < 0) throw storageFailure("object size");
  if (size > maxBytes) throw new Error("source archive is too large");
}

export async function createSignedUpload(path: string) {
  const result = await bucket().createSignedUploadUrl(path);
  if (result.error || !result.data?.token) throw storageFailure("signed upload");
  return { path: result.data.path, token: result.data.token };
}

export async function uploadBuffer(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const result = await bucket().upload(path, body, { contentType, upsert: false });
  if (result.error) throw storageFailure("upload");
}

export async function downloadBuffer(path: string): Promise<Buffer> {
  const result = await bucket().download(path);
  if (result.error || !result.data) throw storageFailure("download");
  return Buffer.from(await result.data.arrayBuffer());
}

export async function signedDownloadUrl(path: string): Promise<string> {
  const result = await bucket().createSignedUrl(path, 900);
  if (result.error || !result.data?.signedUrl) throw storageFailure("signed URL");
  return result.data.signedUrl;
}

export async function deleteObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const result = await bucket().remove(paths);
  if (result.error) throw storageFailure("delete");
}
