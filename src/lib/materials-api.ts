"use client";

import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { ApplicationMaterial, MaterialKind, MaterialsSummary } from "@/lib/materials";

const STORAGE_BUCKET = "generated-documents";

interface ApiEnvelope<T> {
  data?: T;
  msg?: string;
}

interface MaterialsResponse {
  materials: ApplicationMaterial[];
  summary: MaterialsSummary;
}

interface UploadAuthorization {
  material: ApplicationMaterial;
  path: string;
  token: string;
  contentType: string;
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiEnvelope<T>;
  if (!response.ok || !body.data) throw new Error(body.msg || "材料请求失败");
  return body.data;
}

export async function listApplicationMaterials(applicationId: string): Promise<MaterialsResponse> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/materials`));
  return readResponse<MaterialsResponse>(response);
}

export async function uploadApplicationMaterial(
  applicationId: string,
  kind: MaterialKind,
  file: File,
  holderId?: string,
): Promise<ApplicationMaterial> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/materials/upload-url`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      holderId,
    }),
  });
  const authorization = await readResponse<UploadAuthorization>(response);
  const upload = await getSupabaseBrowserClient().storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(authorization.path, authorization.token, file);
  if (upload.error) throw new Error("材料文件上传失败");

  const complete = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/materials/complete`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ materialId: authorization.material.id, size: file.size }),
  });
  return readResponse<ApplicationMaterial>(complete);
}

export async function deleteApplicationMaterial(applicationId: string, materialId: string): Promise<void> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/materials/${encodeURIComponent(materialId)}`), {
    method: "DELETE",
  });
  await readResponse<null>(response);
}
