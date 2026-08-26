import { supabaseAdmin } from "./db.js";
import { env } from "./env.js";

const bucket = () => supabaseAdmin.storage.from(env.storageBucket);

function storageFailure(operation: string): Error {
  // Do not log the SDK error: it may contain provider URLs or request details.
  console.error("storage " + operation + " failed");
  return new Error("storage operation failed");
}

export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error("storage upload aborted");
  const result = await bucket().upload(key, body, {
    contentType,
    upsert: false,
  });
  if (result.error) throw storageFailure("upload");
  return key;
}

export async function signedDownloadUrl(key: string): Promise<string> {
  const result = await bucket().createSignedUrl(key, 900);
  if (result.error || !result.data?.signedUrl) {
    throw storageFailure("signed URL");
  }
  return result.data.signedUrl;
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const result = await bucket().remove(keys);
  if (result.error) throw storageFailure("delete");
}
