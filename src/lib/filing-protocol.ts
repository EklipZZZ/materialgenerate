import type { CopyrightFormData } from "./copyright-form";
import type { FilingProfile } from "./filing-profile";
import type { MaterialKind } from "./materials";

export const FILING_PROTOCOL = "softreg-filing/v1" as const;
export const FILING_SOURCE = "softreg-web" as const;
export const FILING_EXTENSION_SOURCE = "softreg-extension" as const;
export const R11_URL = "https://register.ccopyright.com.cn/registration.html#/registerSoft";

export const filingJobStatuses = [
  "created",
  "waiting_extension",
  "opening_portal",
  "waiting_login",
  "filling",
  "waiting_review",
  "uploading",
  "waiting_user",
  "completed",
  "failed",
  "cancelled",
] as const;
export type FilingJobStatus = typeof filingJobStatuses[number];

export const filingSteps = [
  "pairing",
  "opening_portal",
  "login",
  "r11_entry",
  "application_form",
  "review",
  "materials",
  "signature_page",
  "waiting_user",
  "completed",
] as const;
export type FilingStep = typeof filingSteps[number];

export const filingEventTypes = [
  "EXTENSION_READY",
  "FILING_PROGRESS",
  "FILING_NEEDS_USER",
  "FILING_FAILED",
  "FILING_COMPLETED",
] as const;
export type FilingEventType = typeof filingEventTypes[number];

export const filingEventCodes = [
  "extension_ready",
  "portal_opened",
  "login_required",
  "login_detected",
  "form_started",
  "form_filled",
  "review_required",
  "materials_ready",
  "upload_started",
  "upload_completed",
  "signature_page_required",
  "manual_upload_required",
  "unsupported_development_method",
  "field_not_found",
  "field_ambiguous",
  "field_verification_failed",
  "portal_structure_changed",
  "extension_disconnected",
  "cancelled_by_user",
  "completed",
  "unknown_error",
] as const;
export type FilingEventCode = typeof filingEventCodes[number];

export type FilingMaterialManifest = {
  id: string;
  kind: MaterialKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  checksum: string | null;
  downloadUrl: string;
};

export type FilingManifest = {
  jobId: string;
  targetUrl: typeof R11_URL;
  adapterVersion: string;
  expiresAt: string;
  application: CopyrightFormData;
  filingProfile: FilingProfile;
  materials: FilingMaterialManifest[];
};

export type AppToExtensionMessage =
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_SOURCE; type: "START_FILING"; manifest: FilingManifest }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_SOURCE; type: "RESUME_FILING"; manifest: FilingManifest }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_SOURCE; type: "CANCEL_FILING"; jobId: string };

export type ExtensionToAppMessage =
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "EXTENSION_READY"; version: string }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILING_PROGRESS"; jobId: string; step: FilingStep; code: FilingEventCode; progress: number }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILING_NEEDS_USER"; jobId: string; step: FilingStep; code: FilingEventCode }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILING_FAILED"; jobId: string; step: FilingStep; code: FilingEventCode; retryable: boolean }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILING_COMPLETED"; jobId: string; step: "completed" };

export type BackgroundMessage =
  | AppToExtensionMessage & { appTabId?: number }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "OFFICIAL_READY" }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "OFFICIAL_EVENT"; event: Exclude<ExtensionToAppMessage, { type: "EXTENSION_READY" }> }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILE_REQUEST"; jobId: string; materialId: string };

export type OfficialCommand =
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "BEGIN_FILING"; jobId: string; manifest: FilingManifest }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "RESUME_FILING"; jobId: string; manifest: FilingManifest }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "CANCEL_FILING"; jobId: string };

export type FileTransferMessage =
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILE_TRANSFER_START"; jobId: string; materialId: string; fileName: string; mimeType: string; sizeBytes: number }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILE_TRANSFER_CHUNK"; jobId: string; materialId: string; index: number; total: number; base64: string }
  | { protocol: typeof FILING_PROTOCOL; source: typeof FILING_EXTENSION_SOURCE; type: "FILE_TRANSFER_END"; jobId: string; materialId: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isExtensionToAppMessage(value: unknown): value is ExtensionToAppMessage {
  if (!isRecord(value) || value.protocol !== FILING_PROTOCOL || value.source !== FILING_EXTENSION_SOURCE || typeof value.type !== "string") return false;
  if (value.type === "EXTENSION_READY") return typeof value.version === "string" && value.version.length <= 40;
  if (value.type === "FILING_COMPLETED") return typeof value.jobId === "string" && value.step === "completed";
  if (typeof value.jobId !== "string" || !filingSteps.includes(value.step as FilingStep) || !filingEventCodes.includes(value.code as FilingEventCode)) return false;
  if (value.type === "FILING_PROGRESS") return Number.isInteger(value.progress) && Number(value.progress) >= 0 && Number(value.progress) <= 100;
  if (value.type === "FILING_NEEDS_USER") return true;
  return value.type === "FILING_FAILED" && typeof value.retryable === "boolean";
}

function looksLikeUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isFilingManifest(value: unknown): value is FilingManifest {
  if (!isRecord(value) || !looksLikeUuid(value.jobId) || value.targetUrl !== R11_URL || typeof value.adapterVersion !== "string" || typeof value.expiresAt !== "string") return false;
  if (!isRecord(value.application) || !isRecord(value.filingProfile) || !Array.isArray(value.materials) || value.materials.length > 10) return false;
  const profile = value.filingProfile;
  if (!Object.entries({
    applicant_address: profile.applicant_address,
    postal_code: profile.postal_code,
    contact_name: profile.contact_name,
    contact_phone: profile.contact_phone,
  }).every(([, item]) => typeof item === "string" && item.trim().length > 0 && item.length <= 20_000)) return false;
  const expiry = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
  return value.materials.every((item) => {
    if (!isRecord(item) || !looksLikeUuid(item.id) || typeof item.kind !== "string" || typeof item.fileName !== "string" || typeof item.mimeType !== "string" || typeof item.downloadUrl !== "string") return false;
    try {
      const url = new URL(item.downloadUrl);
      return url.protocol === "https:" && item.fileName.length <= 200 && item.downloadUrl.length <= 4000;
    } catch {
      return false;
    }
  });
}

export function isAppToExtensionMessage(value: unknown): value is AppToExtensionMessage {
  if (!isRecord(value) || value.protocol !== FILING_PROTOCOL || value.source !== FILING_SOURCE || typeof value.type !== "string") return false;
  if (value.type === "CANCEL_FILING") return looksLikeUuid(value.jobId);
  return (value.type === "START_FILING" || value.type === "RESUME_FILING") && isFilingManifest(value.manifest);
}

export function isFileTransferMessage(value: unknown): value is FileTransferMessage {
  if (!isRecord(value) || value.protocol !== FILING_PROTOCOL || value.source !== FILING_EXTENSION_SOURCE || typeof value.type !== "string" || !looksLikeUuid(value.jobId) || !looksLikeUuid(value.materialId)) return false;
  if (value.type === "FILE_TRANSFER_START") return typeof value.fileName === "string" && typeof value.mimeType === "string" && Number.isInteger(value.sizeBytes) && Number(value.sizeBytes) >= 0 && Number(value.sizeBytes) <= 30 * 1024 * 1024;
  if (value.type === "FILE_TRANSFER_CHUNK") return typeof value.base64 === "string" && Number.isInteger(value.index) && Number(value.index) >= 0 && Number.isInteger(value.total) && Number(value.total) > 0 && Number(value.index) < Number(value.total) && value.base64.length <= 400_000;
  return value.type === "FILE_TRANSFER_END";
}
