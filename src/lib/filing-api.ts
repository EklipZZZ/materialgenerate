"use client";

import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import type { FilingEventCode, FilingJobStatus, FilingManifest, FilingStep } from "@/lib/filing-protocol";

export interface FilingJob {
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
  input_materials: Array<{ id: string; kind: string; checksum: string | null }>;
  error_code: FilingEventCode | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilingEvent {
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
  job: FilingJob;
  events: FilingEvent[];
}

export interface FilingStartResponse {
  job: FilingJob;
  manifest: FilingManifest;
}

interface ApiEnvelope<T> { data?: T; msg?: string }

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiEnvelope<T>;
  if (!response.ok || body.data === undefined) throw new Error(body.msg || "填报请求失败");
  return body.data;
}

export async function createFilingJob(applicationId: string, extensionVersion?: string): Promise<FilingStartResponse> {
  const response = await authorizedFetch(apiEndpoint(`/api/applications/${encodeURIComponent(applicationId)}/filing-jobs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "fill_and_upload", browser: "chrome", extensionVersion }),
  });
  return readResponse<FilingStartResponse>(response);
}

export async function getFilingJob(jobId: string): Promise<FilingJobWithEvents> {
  const response = await authorizedFetch(apiEndpoint(`/api/filing-jobs/${encodeURIComponent(jobId)}`));
  return readResponse<FilingJobWithEvents>(response);
}

export async function getLatestFilingJob(applicationId: string): Promise<FilingJob | null> {
  const response = await authorizedFetch(apiEndpoint(`/api/filing-jobs?applicationId=${encodeURIComponent(applicationId)}`));
  return readResponse<FilingJob | null>(response);
}

export async function recordFilingEvent(jobId: string, event: {
  type: "EXTENSION_READY" | "FILING_PROGRESS" | "FILING_NEEDS_USER" | "FILING_FAILED" | "FILING_COMPLETED";
  step: FilingStep;
  code: FilingEventCode;
  progress?: number;
  extensionVersion?: string;
  retryable?: boolean;
}): Promise<FilingJob> {
  const response = await authorizedFetch(apiEndpoint(`/api/filing-jobs/${encodeURIComponent(jobId)}/events`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  const data = await readResponse<{ job: FilingJob }>(response);
  return data.job;
}

export async function resumeFilingJob(jobId: string, extensionVersion?: string): Promise<FilingStartResponse> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (extensionVersion) headers.set("x-filing-extension-version", extensionVersion);
  const response = await authorizedFetch(apiEndpoint(`/api/filing-jobs/${encodeURIComponent(jobId)}/resume`), {
    method: "POST",
    headers,
    body: "{}",
  });
  return readResponse<FilingStartResponse>(response);
}

export async function cancelFilingJob(jobId: string): Promise<FilingJob> {
  const response = await authorizedFetch(apiEndpoint(`/api/filing-jobs/${encodeURIComponent(jobId)}/cancel`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await readResponse<{ job: FilingJob }>(response);
  return data.job;
}

export function isActiveFilingJob(job: FilingJob | null): boolean {
  return Boolean(job && ["created", "waiting_extension", "opening_portal", "waiting_login", "filling", "waiting_review", "uploading", "waiting_user"].includes(job.status));
}
