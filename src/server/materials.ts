import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  materialLabels,
  type ApplicationMaterial,
  type MaterialKind,
  type MaterialStatus,
} from "@/lib/materials";
import {
  materialCompleteSchema,
  materialUploadSchema,
} from "./api-contracts.ts";
import { getSupabaseAdmin } from "./config";
import { assertObjectSize, createSignedUpload, deleteObjects, signedDownloadUrl } from "./storage";

const MAX_MATERIAL_BYTES = 30 * 1024 * 1024;

export { materialCompleteSchema, materialKindSchema, materialUploadSchema } from "./api-contracts.ts";

export interface MaterialUploadAuthorization {
  material: ApplicationMaterial;
  path: string;
  token: string;
  contentType: string;
}

function safeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim()
    .slice(0, 120) || "material.pdf";
}

function allowedExtensions(kind: MaterialKind): string[] {
  if (kind === "signature_page") return [".pdf"];
  if (kind === "cooperation_agreement" || kind === "commission_agreement" || kind === "task_order") {
    return [".pdf", ".doc", ".docx"];
  }
  return [".pdf", ".png", ".jpg", ".jpeg"];
}

function validateFileName(kind: MaterialKind, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return allowedExtensions(kind).some((extension) => lower.endsWith(extension));
}

function slotRequired(kind: MaterialKind, developmentMethod: string): boolean {
  if (kind === "cooperation_agreement") return developmentMethod === "cooperative";
  if (kind === "commission_agreement") return developmentMethod === "commissioned";
  if (kind === "task_order") return developmentMethod === "assigned_task";
  return kind === "signature_page";
}

function requiredMaterialKinds(developmentMethod: string): MaterialKind[] {
  const kinds: MaterialKind[] = [
    "source_code_docx",
    "source_code_pdf",
    "user_manual_docx",
    "user_manual_pdf",
    "signature_page",
  ];
  if (developmentMethod === "cooperative") kinds.push("cooperation_agreement");
  if (developmentMethod === "commissioned") kinds.push("commission_agreement");
  if (developmentMethod === "assigned_task") kinds.push("task_order");
  return kinds;
}

function materialReady(material: ApplicationMaterial): boolean {
  return material.status === "generated" || material.status === "uploaded";
}

function mapMaterial(row: Record<string, unknown>, downloadUrl?: string | null): ApplicationMaterial {
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    generation_record_id: row.generation_record_id as string | null | undefined,
    holder_id: row.holder_id as string | null | undefined,
    kind: row.kind as MaterialKind,
    status: row.status as MaterialStatus,
    required: Boolean(row.required),
    source: row.source as ApplicationMaterial["source"],
    file_name: row.file_name as string | null | undefined,
    mime_type: row.mime_type as string | null | undefined,
    size_bytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    checksum: row.checksum as string | null | undefined,
    download_url: downloadUrl || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function signedUrlIfPresent(objectKey: unknown): Promise<string | null> {
  return typeof objectKey === "string" && objectKey ? signedDownloadUrl(objectKey) : null;
}

export async function ensureWorkflowMaterialSlots(applicationId: string, userId: string, developmentMethod: string) {
  const slots: Array<{ kind: MaterialKind; status: MaterialStatus; source: "uploaded" | "official"; required: boolean }> = [
    {
      kind: "cooperation_agreement",
      status: developmentMethod === "cooperative" ? "missing" : "awaiting_user",
      source: "uploaded",
      required: developmentMethod === "cooperative",
    },
    { kind: "signature_page", status: "awaiting_official", source: "official", required: true },
  ];
  if (developmentMethod === "commissioned") {
    slots.push({ kind: "commission_agreement", status: "missing", source: "uploaded", required: true });
  }
  if (developmentMethod === "assigned_task") {
    slots.push({ kind: "task_order", status: "missing", source: "uploaded", required: true });
  }
  for (const slot of slots) {
    const existing = await getSupabaseAdmin().from("application_materials")
      .select("id,status,object_key,source")
      .eq("application_id", applicationId)
      .eq("user_id", userId)
      .eq("kind", slot.kind)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error("材料槽位读取失败");
    if (existing.data) {
      const currentStatus = existing.data.status as MaterialStatus;
      const hasUploadedFile = currentStatus === "uploaded" && Boolean(existing.data.object_key);
      const updated = await getSupabaseAdmin().from("application_materials")
        .update({
          required: slot.required,
          status: hasUploadedFile ? "uploaded" : slot.status,
          source: hasUploadedFile ? "uploaded" : slot.source,
        })
        .eq("id", existing.data.id);
      if (updated.error) throw new Error("材料槽位更新失败");
    } else {
      const inserted = await getSupabaseAdmin().from("application_materials").insert({
        user_id: userId,
        application_id: applicationId,
        kind: slot.kind,
        status: slot.status,
        required: slot.required,
        source: slot.source,
      });
      if (inserted.error) throw new Error("材料槽位创建失败");
    }
  }
}

export async function listOwnedMaterials(applicationId: string, userId: string, developmentMethod = "independent") {
  await ensureWorkflowMaterialSlots(applicationId, userId, developmentMethod);
  const result = await getSupabaseAdmin()
    .from("application_materials")
    .select("*")
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error("application material lookup failed");

  const latest = new Map<string, Record<string, unknown>>();
  for (const row of (result.data || []) as Record<string, unknown>[]) {
    const kind = String(row.kind);
    if (!latest.has(kind)) latest.set(kind, row);
  }
  const materials = await Promise.all(Array.from(latest.values()).map(async (row) => {
    let url: string | null = null;
    if (row.object_key && (row.status === "generated" || row.status === "uploaded")) {
      url = await signedUrlIfPresent(row.object_key);
    }
    return mapMaterial(row, url);
  }));
  const required = requiredMaterialKinds(developmentMethod);
  const readyCount = required.filter((kind) => {
    const material = materials.find((item) => item.kind === kind);
    return Boolean(material && materialReady(material));
  }).length;
  return {
    materials,
    summary: {
      complete: readyCount === required.length,
      requiredCount: required.length,
      readyCount,
    },
  };
}

export async function createMaterialUploadAuthorization(
  applicationId: string,
  userId: string,
  input: z.infer<typeof materialUploadSchema>,
  developmentMethod: string,
): Promise<MaterialUploadAuthorization> {
  if (!["cooperation_agreement", "signature_page", "holder_identity_proof", "commission_agreement", "task_order"].includes(input.kind)) {
    throw new Error("该材料暂不支持上传");
  }
  const fileName = safeFileName(input.fileName);
  if (!validateFileName(input.kind, fileName)) {
    throw new Error(`材料格式不支持：${materialLabels[input.kind]}`);
  }
  if (input.kind === "cooperation_agreement" && developmentMethod !== "cooperative") {
    throw new Error("只有合作开发申请需要上传合作开发协议");
  }
  if (input.kind === "commission_agreement" && developmentMethod !== "commissioned") {
    throw new Error("只有委托开发申请需要上传委托开发协议");
  }
  if (input.kind === "task_order" && developmentMethod !== "assigned_task") {
    throw new Error("只有下达任务开发申请需要上传证明材料");
  }
  if (input.holderId) {
    const holder = await getSupabaseAdmin().from("copyright_holders")
      .select("id")
      .eq("id", input.holderId)
      .eq("application_id", applicationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (holder.error) throw new Error("著作权人查询失败");
    if (!holder.data) throw new Error("著作权人不存在");
  }
  const contentType = input.contentType || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  const path = `materials/${userId}/${applicationId}/${input.kind}-${randomUUID()}-${fileName}`;
  const signed = await createSignedUpload(path);
  const result = await getSupabaseAdmin().from("application_materials").insert({
    user_id: userId,
    application_id: applicationId,
    holder_id: input.holderId || null,
    kind: input.kind,
    status: "awaiting_user",
    required: slotRequired(input.kind, developmentMethod),
    source: "uploaded",
    file_name: fileName,
    object_key: path,
    mime_type: contentType,
    size_bytes: input.size,
  }).select("*").single();
  if (result.error || !result.data) {
    await deleteObjects([path]).catch(() => undefined);
    throw new Error("创建材料上传任务失败");
  }
  return {
    material: mapMaterial(result.data as Record<string, unknown>),
    path: signed.path,
    token: signed.token,
    contentType,
  };
}

export async function completeMaterialUpload(
  applicationId: string,
  userId: string,
  input: z.infer<typeof materialCompleteSchema>,
) {
  const lookup = await getSupabaseAdmin().from("application_materials")
    .select("*")
    .eq("id", input.materialId)
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookup.error) throw new Error("材料查询失败");
  if (!lookup.data) return null;
  const row = lookup.data as Record<string, unknown>;
  const objectKey = row.object_key;
  if (typeof objectKey !== "string" || !objectKey.startsWith(`materials/${userId}/${applicationId}/`)) {
    throw new Error("材料文件无效");
  }
  await assertObjectSize(objectKey, MAX_MATERIAL_BYTES);
  const result = await getSupabaseAdmin().from("application_materials")
    .update({
      status: "uploaded",
      size_bytes: input.size || row.size_bytes,
      checksum: input.checksum || row.checksum,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.materialId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (result.error || !result.data) throw new Error("材料状态更新失败");
  return mapMaterial(result.data as Record<string, unknown>, await signedUrlIfPresent(objectKey));
}

export async function deleteOwnedMaterial(applicationId: string, userId: string, materialId: string): Promise<boolean> {
  const lookup = await getSupabaseAdmin().from("application_materials")
    .select("id,object_key")
    .eq("id", materialId)
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookup.error) throw new Error("材料查询失败");
  if (!lookup.data) return false;
  const objectKey = lookup.data.object_key;
  if (typeof objectKey === "string" && objectKey) await deleteObjects([objectKey]);
  const result = await getSupabaseAdmin().from("application_materials")
    .delete().eq("id", materialId).eq("application_id", applicationId).eq("user_id", userId);
  if (result.error) throw new Error("材料删除失败");
  return true;
}

export async function recordGeneratedMaterials(input: {
  applicationId: string;
  userId: string;
  generationRecordId: string;
  developmentMethod: string;
  files: Array<{ kind: MaterialKind; fileName: string; objectKey: string; mimeType: string; sizeBytes: number }>;
}) {
  const generatedRows = input.files.map((file) => ({
    user_id: input.userId,
    application_id: input.applicationId,
    generation_record_id: input.generationRecordId,
    kind: file.kind,
    status: "generated",
    required: file.kind !== "application_summary_pdf",
    source: "generated",
    file_name: file.fileName,
    object_key: file.objectKey,
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
  }));
  if (generatedRows.length) {
    const result = await getSupabaseAdmin().from("application_materials").insert(generatedRows);
    if (result.error) throw new Error("生成材料记录失败");
  }

  await ensureWorkflowMaterialSlots(input.applicationId, input.userId, input.developmentMethod);
}
