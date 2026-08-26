"use client";

import {
  EMPTY_COPYRIGHT_FORM,
  formToUpdatePayload,
  recordToFormData,
  type CopyrightFormData,
} from "@/lib/copyright-form";
import { API_URL, requireApiUrl } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";

interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export interface ApplicationRecord extends CopyrightFormData {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>> & {
    detail?: string;
    message?: string;
  };
  if (!response.ok || (typeof body.code === "number" && body.code >= 400)) {
    throw new Error(body.msg || body.detail || body.message || "请求失败");
  }
  return body.data as T;
}

function endpoint(path: string): string {
  return requireApiUrl(API_URL, "NEXT_PUBLIC_API_URL") + path;
}

export async function listApplications(): Promise<ApplicationRecord[]> {
  const response = await authorizedFetch(endpoint("/api/applications"));
  const data = await unwrap<Record<string, unknown>[]>(response);
  return data.map((record) => recordToFormData(record) as ApplicationRecord);
}

export async function getApplication(id: string): Promise<ApplicationRecord> {
  const response = await authorizedFetch(endpoint("/api/applications/" + encodeURIComponent(id)));
  return recordToFormData(await unwrap<Record<string, unknown>>(response)) as ApplicationRecord;
}

export async function createApplication(
  form: CopyrightFormData = EMPTY_COPYRIGHT_FORM,
): Promise<ApplicationRecord> {
  const response = await authorizedFetch(endpoint("/api/applications"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formToUpdatePayload(form)),
  });
  return recordToFormData(await unwrap<Record<string, unknown>>(response)) as ApplicationRecord;
}

export async function updateApplication(
  id: string,
  form: CopyrightFormData,
): Promise<ApplicationRecord> {
  const response = await authorizedFetch(endpoint("/api/applications/" + encodeURIComponent(id)), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formToUpdatePayload(form)),
  });
  return recordToFormData(await unwrap<Record<string, unknown>>(response)) as ApplicationRecord;
}

export async function deleteApplication(id: string): Promise<void> {
  const response = await authorizedFetch(endpoint("/api/applications/" + encodeURIComponent(id)), {
    method: "DELETE",
  });
  await unwrap(response);
}
