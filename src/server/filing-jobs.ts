import { z } from "zod";
import { ApiError } from "./http";
import {
  effectiveApplication,
  getOwnedApplication,
} from "./applications";
import type { ApplicationRow } from "./applications";
import { listOwnedMaterials } from "./materials";
import { getSupabaseAdmin } from "./config";
import {
  filingJobCreateSchema,
  filingJobEventSchema,
} from "./api-contracts.ts";
import { recordToFormData, validateCopyrightForm, type CopyrightFormData } from "@/lib/copyright-form";
import {
  filingEventCodes,
  R11_URL,
  type FilingEventCode,
  type FilingJobStatus,
  type FilingManifest,
  type FilingMaterialManifest,
  type FilingStep,
} from "@/lib/filing-protocol";
import type { ApplicationMaterial, MaterialKind } from "@/lib/materials";

export type { FilingJobStatus } from "@/lib/filing-protocol";

export interface FilingJobRow {
  id: string;
  user_id: string;
  application_id: string;
  status: FilingJobStatus;
  current_step: FilingStep;
  progress: number;
  adapter_version: string;
  extension_version: string | null;
  browser: "chrome" | "edge";
  input_application_updated_at: string | null;
  input_materials: Array<{ id: string; kind: MaterialKind; checksum: string | null }>;
  error_code: FilingEventCode | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilingEventRow {
  id: string;
  user_id: string;
  job_id: string;
  step: FilingStep;
  code: FilingEventCode;
  progress: number | null;
  extension_version: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface FilingJobWithEvents {
  job: FilingJobRow;
  events: FilingEventRow[];
}

export interface FilingJobCreateInput {
  mode: "fill_and_upload";
  browser: "chrome";
  extensionVersion?: string;
}

const ACTIVE_STATUSES: FilingJobStatus[] = [
  "created",
  "waiting_extension",
  "opening_portal",
  "waiting_login",
  "filling",
  "waiting_review",
  "uploading",
  "waiting_user",
];

const MATERIAL_KINDS_FOR_PORTAL: MaterialKind[] = [
  "source_code_pdf",
  "user_manual_pdf",
  "cooperation_agreement",
  "commission_agreement",
  "task_order",
  "signature_page",
];

const PROGRESS_EVENT_CODES: FilingEventCode[] = [
  "portal_opened",
  "login_detected",
  "form_started",
  "form_filled",
  "materials_ready",
  "upload_started",
  "upload_completed",
];
const USER_PAUSE_EVENT_CODES: FilingEventCode[] = [
  "login_required",
  "review_required",
  "signature_page_required",
  "manual_upload_required",
];
const FAILURE_EVENT_CODES: FilingEventCode[] = [
  "unsupported_development_method",
  "field_not_found",
  "field_ambiguous",
  "field_verification_failed",
  "portal_structure_changed",
  "extension_disconnected",
  "unknown_error",
  "manual_upload_required",
];

function asJob(row: Record<string, unknown>): FilingJobRow {
  const inputMaterials = Array.isArray(row.input_materials) ? row.input_materials : [];
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    application_id: String(row.application_id),
    status: row.status as FilingJobStatus,
    current_step: row.current_step as FilingStep,
    progress: Number(row.progress || 0),
    adapter_version: String(row.adapter_version || "r11-v1"),
    extension_version: typeof row.extension_version === "string" ? row.extension_version : null,
    browser: row.browser === "edge" ? "edge" : "chrome",
    input_application_updated_at: typeof row.input_application_updated_at === "string" ? row.input_application_updated_at : null,
    input_materials: inputMaterials.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((item) => ({
      id: String(item.id || ""),
      kind: item.kind as MaterialKind,
      checksum: typeof item.checksum === "string" ? item.checksum : null,
    })).filter((item) => item.id && MATERIAL_KINDS_FOR_PORTAL.includes(item.kind)),
    error_code: filingEventCodes.includes(row.error_code as FilingEventCode) ? row.error_code as FilingEventCode : null,
    error_message: typeof row.error_message === "string" ? row.error_message : null,
    started_at: typeof row.started_at === "string" ? row.started_at : null,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function asEvent(row: Record<string, unknown>): FilingEventRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    job_id: String(row.job_id),
    step: row.step as FilingStep,
    code: row.code as FilingEventCode,
    progress: row.progress === null || row.progress === undefined ? null : Number(row.progress),
    extension_version: typeof row.extension_version === "string" ? row.extension_version : null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : null,
    created_at: String(row.created_at),
  };
}

function currentForm(application: ApplicationRow): CopyrightFormData {
  const effective = effectiveApplication(application).effective_form as Record<string, unknown>;
  return recordToFormData(effective);
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function validateFilingForm(form: CopyrightFormData): string[] {
  const errors = validateCopyrightForm(form, true);
  const required: Array<[keyof CopyrightFormData, string]> = [
    ["software_full_name", "软件全称"],
    ["version", "版本号"],
    ["software_category", "软件分类"],
    ["development_date", "开发完成日期"],
    ["development_hardware", "开发的硬件环境"],
    ["runtime_hardware", "运行的硬件环境"],
    ["development_os", "开发操作系统"],
    ["development_tools", "软件开发环境工具"],
    ["runtime_platform", "运行平台操作系统"],
    ["runtime_environment", "软件运行支撑环境"],
    ["programming_language", "编程语言"],
    ["development_purpose", "开发目的"],
    ["target_industry", "面向领域/行业"],
    ["technical_features", "软件技术特点"],
  ];
  for (const [field, label] of required) {
    if (!nonEmpty(form[field])) errors.push(`请填写${label}`);
  }
  if (!Number.isInteger(form.source_code_lines) || form.source_code_lines <= 0) errors.push("请填写源代码行数");
  if (form.work_type === "modified") {
    if (!nonEmpty(form.original_registration_number)) errors.push("修改作品请填写原登记号");
    if (!nonEmpty(form.modification_description)) errors.push("修改作品请填写修改说明");
  }
  if (form.rights_scope === "partial" && !nonEmpty(form.rights_scope_description)) errors.push("部分权利请填写权利范围说明");
  if (form.is_published && (!nonEmpty(form.first_publication_date) || !nonEmpty(form.first_publication_country) || !nonEmpty(form.first_publication_city))) {
    errors.push("已发表作品请填写首次发表日期、国家和城市");
  }
  if (!form.copyright_holders.length) {
    errors.push("请至少添加一名明确的著作权人");
  }
  for (const [index, holder] of form.copyright_holders.entries()) {
    const label = `第 ${index + 1} 名著作权人`;
    if (!nonEmpty(holder.name)) errors.push(`${label}缺少名称`);
    if (!nonEmpty(holder.category)) errors.push(`${label}缺少类别`);
    if (!nonEmpty(holder.document_type)) errors.push(`${label}缺少证件类型`);
    if (!nonEmpty(holder.document_number)) errors.push(`${label}缺少证件号码`);
    if (!nonEmpty(holder.nationality) || !nonEmpty(holder.province) || !nonEmpty(holder.city)) errors.push(`${label}缺少国籍或地区`);
  }
  if (!nonEmpty(form.applicant_address)) errors.push("请填写申请人地址");
  if (!nonEmpty(form.contact_name) || !nonEmpty(form.contact_phone) || !nonEmpty(form.contact_email)) errors.push("请填写联系人、联系电话和电子邮箱");
  return errors;
}

function materialIsReady(material: ApplicationMaterial | undefined): boolean {
  return Boolean(material && (material.status === "generated" || material.status === "uploaded") && material.download_url);
}

function requiredMaterialError(form: CopyrightFormData, materials: ApplicationMaterial[]): string | null {
  const byKind = new Map(materials.map((material) => [material.kind, material]));
  if (!materialIsReady(byKind.get("source_code_pdf"))) return "请先生成源代码 PDF";
  if (!materialIsReady(byKind.get("user_manual_pdf"))) return "请先生成用户手册 PDF";
  const proofByMethod: Partial<Record<CopyrightFormData["development_method"], MaterialKind>> = {
    cooperative: "cooperation_agreement",
    commissioned: "commission_agreement",
    assigned_task: "task_order",
  };
  const proofKind = proofByMethod[form.development_method];
  if (proofKind && !materialIsReady(byKind.get(proofKind))) return `请先上传${proofKind === "cooperation_agreement" ? "合作开发协议" : "开发证明材料"}`;
  return null;
}

function safeMaterialManifest(material: ApplicationMaterial): FilingMaterialManifest | null {
  if (!MATERIAL_KINDS_FOR_PORTAL.includes(material.kind) || !materialIsReady(material) || !material.download_url) return null;
  return {
    id: material.id,
    kind: material.kind,
    fileName: material.file_name || `${material.kind}.pdf`,
    mimeType: material.mime_type || "application/pdf",
    sizeBytes: material.size_bytes ?? null,
    checksum: material.checksum ?? null,
    downloadUrl: material.download_url,
  };
}

async function applicationAndMaterials(applicationId: string, userId: string) {
  const application = await getOwnedApplication(applicationId, userId);
  if (!application) throw new ApiError(404, "申请不存在");
  const form = currentForm(application);
  const validationErrors = validateFilingForm(form);
  if (validationErrors.length) throw new ApiError(422, validationErrors[0]);
  const materials = await listOwnedMaterials(applicationId, userId, form.development_method);
  const materialError = requiredMaterialError(form, materials.materials);
  if (materialError) throw new ApiError(422, materialError);
  return { application, form, materials: materials.materials };
}

async function buildManifest(jobId: string, applicationId: string, userId: string, adapterVersion: string): Promise<{ manifest: FilingManifest; inputMaterials: FilingJobRow["input_materials"] }> {
  const { form, materials } = await applicationAndMaterials(applicationId, userId);
  const manifestMaterials = materials.map(safeMaterialManifest).filter((item): item is FilingMaterialManifest => Boolean(item));
  const inputMaterials = manifestMaterials.map((material) => ({
    id: material.id,
    kind: material.kind,
    checksum: material.checksum,
  }));
  const expiresAt = new Date(Date.now() + 14 * 60 * 1000).toISOString();
  return {
    manifest: {
      jobId,
      targetUrl: R11_URL,
      adapterVersion,
      expiresAt,
      application: form,
      materials: manifestMaterials,
    },
    inputMaterials,
  };
}

async function recoverStaleFilingJob(applicationId: string, userId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin().from("filing_jobs")
    .update({
      status: "failed",
      current_step: "waiting_user",
      error_code: "extension_disconnected",
      error_message: "填报连接已中断，可以重新配对并继续。",
      completed_at: now,
      updated_at: now,
    })
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .lt("updated_at", staleBefore)
    .select("id,user_id,current_step,progress");
  if (result.error) throw new Error("stale filing job recovery failed");
  const recovered = (result.data || []) as Array<Record<string, unknown>>;
  if (!recovered.length) return false;
  const eventResult = await getSupabaseAdmin().from("filing_events").insert(recovered.map((job) => ({
    user_id: String(job.user_id),
    job_id: String(job.id),
    step: "waiting_user",
    code: "extension_disconnected",
    progress: Number(job.progress || 0),
    metadata: { source: "server", recovery: "stale_timeout" },
  })));
  if (eventResult.error) console.error("filing stale recovery event failed", { code: eventResult.error.code });
  return true;
}

export async function createFilingJob(input: {
  userId: string;
  applicationId: string;
  request: FilingJobCreateInput;
}): Promise<{ job: FilingJobRow; manifest: FilingManifest }> {
  const parsed = filingJobCreateSchema.safeParse(input.request);
  if (!parsed.success) throw new ApiError(400, "填报任务参数无效");
  await applicationAndMaterials(input.applicationId, input.userId);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await getSupabaseAdmin().from("filing_jobs").insert({
      user_id: input.userId,
      application_id: input.applicationId,
      status: "created",
      current_step: "pairing",
      progress: 0,
      adapter_version: "r11-v1",
      extension_version: parsed.data.extensionVersion || null,
      browser: parsed.data.browser,
    }).select("*").single();
    if (!result.error && result.data) {
      const job = asJob(result.data as Record<string, unknown>);
      try {
        const built = await buildManifest(job.id, input.applicationId, input.userId, job.adapter_version);
        const updated = await getSupabaseAdmin().from("filing_jobs").update({
          status: "waiting_extension",
          input_application_updated_at: (await getOwnedApplication(input.applicationId, input.userId))?.updated_at || null,
          input_materials: built.inputMaterials,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("user_id", input.userId).select("*").single();
        if (updated.error || !updated.data) throw new Error("filing job preparation failed");
        return { job: asJob(updated.data as Record<string, unknown>), manifest: built.manifest };
      } catch (error) {
        await getSupabaseAdmin().from("filing_jobs").update({
          status: "failed",
          current_step: "pairing",
          error_code: "unknown_error",
          error_message: error instanceof ApiError ? error.message : "填报任务准备失败，请检查申请和材料后重试。",
          completed_at: new Date().toISOString(),
        }).eq("id", job.id).eq("user_id", input.userId);
        throw error;
      }
    }
    if (result.error?.code === "23505" && attempt === 0) {
      if (await recoverStaleFilingJob(input.applicationId, input.userId)) continue;
      throw new ApiError(409, "同一申请已有填报任务，请继续现有任务或先取消它");
    }
    if (result.error?.code === "23505") throw new ApiError(409, "同一申请已有填报任务，请继续现有任务或先取消它");
    throw new Error("filing job creation failed");
  }
  throw new Error("filing job creation failed");
}

export async function getOwnedFilingJob(jobId: string, userId: string): Promise<FilingJobRow | null> {
  const result = await getSupabaseAdmin().from("filing_jobs").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error("filing job lookup failed");
  return result.data ? asJob(result.data as Record<string, unknown>) : null;
}

export async function getOwnedFilingJobWithEvents(jobId: string, userId: string): Promise<FilingJobWithEvents | null> {
  const job = await getOwnedFilingJob(jobId, userId);
  if (!job) return null;
  const result = await getSupabaseAdmin().from("filing_events")
    .select("id,user_id,job_id,step,code,progress,extension_version,metadata,created_at")
    .eq("job_id", jobId).eq("user_id", userId).order("created_at", { ascending: true });
  if (result.error) throw new Error("filing event lookup failed");
  return { job, events: ((result.data || []) as Record<string, unknown>[]).map(asEvent) };
}

export async function getLatestOwnedFilingJob(applicationId: string, userId: string): Promise<FilingJobRow | null> {
  const result = await getSupabaseAdmin().from("filing_jobs").select("*")
    .eq("application_id", applicationId).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("filing job lookup failed");
  return result.data ? asJob(result.data as Record<string, unknown>) : null;
}

function nextState(event: z.infer<typeof filingJobEventSchema>): { status?: FilingJobStatus; step?: FilingStep; errorMessage?: string; completed?: boolean } {
  if (event.type === "EXTENSION_READY") return { status: "waiting_extension", step: "pairing" };
  if (event.type === "FILING_COMPLETED") return { status: "completed", step: "completed", completed: true };
  if (event.type === "FILING_FAILED") return {
    status: "failed",
    step: event.step,
    errorMessage: filingErrorMessage(event.code),
  };
  if (event.type === "FILING_NEEDS_USER") {
    if (event.code === "login_required") return { status: "waiting_login", step: "login" };
    if (event.code === "review_required") return { status: "waiting_review", step: "review" };
    return { status: "waiting_user", step: event.step };
  }
  if (event.code === "portal_opened") return { status: "opening_portal", step: "opening_portal" };
  if (event.code === "login_detected") return { status: "filling", step: "r11_entry" };
  if (event.code === "upload_started") return { status: "uploading", step: "materials" };
  if (event.code === "upload_completed") return { status: "uploading", step: "materials" };
  if (event.code === "form_started" || event.code === "form_filled") return { status: "filling", step: "application_form" };
  if (event.code === "review_required") return { status: "waiting_review", step: "review" };
  return { step: event.step };
}

function filingErrorMessage(code: FilingEventCode): string {
  const messages: Partial<Record<FilingEventCode, string>> = {
    unsupported_development_method: "当前扩展版本暂不支持该开发方式。",
    field_not_found: "官方页面缺少可确认的目标字段，已安全暂停。",
    field_ambiguous: "官方页面存在多个无法唯一确认的目标字段，已安全暂停。",
    field_verification_failed: "官方页面字段写入后校验不一致，已安全暂停。",
    portal_structure_changed: "官方页面结构可能已变化，已安全暂停。",
    manual_upload_required: "官方文件控件无法安全自动上传，请改为人工上传。",
    signature_page_required: "请在官方系统生成申请确认签章页，签字/盖章后上传 PDF，再继续填报。",
    review_required: "请在官方页面复核申请信息后继续填报。",
    extension_disconnected: "填报连接已中断，可以重新配对并继续。",
  };
  return messages[code] || "自动填报未完成，请检查官方页面后重试。";
}

function assertFilingEventShape(event: z.infer<typeof filingJobEventSchema>): void {
  const valid = event.type === "EXTENSION_READY"
    ? event.step === "pairing" && event.code === "extension_ready"
    : event.type === "FILING_COMPLETED"
      ? event.step === "completed" && event.code === "completed"
      : event.type === "FILING_PROGRESS"
        ? PROGRESS_EVENT_CODES.includes(event.code) && event.progress !== undefined
        : event.type === "FILING_NEEDS_USER"
          ? USER_PAUSE_EVENT_CODES.includes(event.code)
          : FAILURE_EVENT_CODES.includes(event.code);
  if (!valid) throw new ApiError(400, "填报事件类型与步骤不匹配");
}

export async function recordFilingEvent(input: {
  jobId: string;
  userId: string;
  event: z.infer<typeof filingJobEventSchema>;
}): Promise<FilingJobRow> {
  assertFilingEventShape(input.event);
  const job = await getOwnedFilingJob(input.jobId, input.userId);
  if (!job) throw new ApiError(404, "填报任务不存在");
  if (job.status === "cancelled" || job.status === "completed" || job.status === "failed") return job;
  const transition = nextState(input.event);
  const eventResult = await getSupabaseAdmin().from("filing_events").insert({
    job_id: job.id,
    user_id: input.userId,
    step: input.event.step,
    code: input.event.code,
    progress: input.event.progress ?? null,
    extension_version: input.event.extensionVersion || job.extension_version,
    metadata: { source: "extension", event_type: input.event.type },
  });
  if (eventResult.error) throw new Error("filing event creation failed");
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...(transition.status ? { status: transition.status } : {}),
    ...(transition.step ? { current_step: transition.step } : {}),
    ...(input.event.progress !== undefined ? { progress: input.event.progress } : {}),
    ...(input.event.extensionVersion ? { extension_version: input.event.extensionVersion } : {}),
  };
  if (transition.status === "opening_portal" || transition.status === "waiting_login" || transition.status === "filling" || transition.status === "waiting_extension") {
    patch.started_at = job.started_at || new Date().toISOString();
  }
  if (transition.status === "failed") {
    patch.error_code = input.event.code;
    patch.error_message = transition.errorMessage;
    patch.completed_at = new Date().toISOString();
  }
  if (input.event.type === "FILING_NEEDS_USER") {
    patch.error_code = input.event.code;
    patch.error_message = filingErrorMessage(input.event.code);
  }
  if (transition.completed) {
    patch.error_code = null;
    patch.error_message = null;
    patch.completed_at = new Date().toISOString();
    patch.progress = 100;
  }
  const update = await getSupabaseAdmin().from("filing_jobs").update(patch).eq("id", job.id).eq("user_id", input.userId).select("*").single();
  if (update.error || !update.data) throw new Error("filing job update failed");
  return asJob(update.data as Record<string, unknown>);
}

export async function resumeFilingJob(jobId: string, userId: string, extensionVersion?: string): Promise<{ job: FilingJobRow; manifest: FilingManifest }> {
  const job = await getOwnedFilingJob(jobId, userId);
  if (!job) throw new ApiError(404, "填报任务不存在");
  if (job.status === "completed") throw new ApiError(409, "填报任务已经完成");
  if (job.status === "cancelled") throw new ApiError(409, "填报任务已取消");
  const built = await buildManifest(job.id, job.application_id, userId, job.adapter_version);
  const update = await getSupabaseAdmin().from("filing_jobs").update({
    status: "waiting_extension",
    current_step: "pairing",
    progress: Math.min(job.progress, 95),
    extension_version: extensionVersion || job.extension_version,
    input_application_updated_at: (await getOwnedApplication(job.application_id, userId))?.updated_at || job.input_application_updated_at,
    input_materials: built.inputMaterials,
    error_code: null,
    error_message: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id).eq("user_id", userId).select("*").single();
  if (update.error || !update.data) throw new Error("filing job resume failed");
  return { job: asJob(update.data as Record<string, unknown>), manifest: built.manifest };
}

export async function cancelFilingJob(jobId: string, userId: string): Promise<FilingJobRow> {
  const job = await getOwnedFilingJob(jobId, userId);
  if (!job) throw new ApiError(404, "填报任务不存在");
  if (job.status === "completed") throw new ApiError(409, "填报任务已经完成，不能取消");
  if (job.status === "cancelled") return job;
  const now = new Date().toISOString();
  const eventResult = await getSupabaseAdmin().from("filing_events").insert({
    job_id: job.id,
    user_id: userId,
    step: job.current_step,
    code: "cancelled_by_user",
    progress: job.progress,
    metadata: { source: "web" },
  });
  if (eventResult.error) throw new Error("filing cancel event failed");
  const update = await getSupabaseAdmin().from("filing_jobs").update({
    status: "cancelled",
    current_step: "waiting_user",
    error_code: "cancelled_by_user",
    error_message: "已由用户取消填报任务。",
    completed_at: now,
    updated_at: now,
  }).eq("id", job.id).eq("user_id", userId).select("*").single();
  if (update.error || !update.data) throw new Error("filing job cancel failed");
  return asJob(update.data as Record<string, unknown>);
}
