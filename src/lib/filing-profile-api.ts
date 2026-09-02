"use client";

import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { EMPTY_FILING_PROFILE, isFilingProfileComplete, type FilingProfile } from "@/lib/filing-profile";

interface ApiEnvelope<T> {
  data?: T;
  msg?: string;
}

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiEnvelope<T>;
  if (!response.ok || body.data === undefined) throw new Error(body.msg || fallback);
  return body.data;
}

function normalize(value: FilingProfile | null): FilingProfile | null {
  if (!value) return null;
  return {
    applicant_address: typeof value.applicant_address === "string" ? value.applicant_address : "",
    postal_code: typeof value.postal_code === "string" ? value.postal_code : "",
    contact_name: typeof value.contact_name === "string" ? value.contact_name : "",
    contact_phone: typeof value.contact_phone === "string" ? value.contact_phone : "",
  };
}

export async function getFilingProfile(): Promise<FilingProfile | null> {
  const response = await authorizedFetch(apiEndpoint("/api/filing-profile"));
  return normalize(await readResponse<FilingProfile | null>(response, "获取官网填报资料失败"));
}

export async function saveFilingProfile(profile: FilingProfile): Promise<FilingProfile> {
  const response = await authorizedFetch(apiEndpoint("/api/filing-profile"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicant_address: profile.applicant_address,
      postal_code: profile.postal_code,
      contact_name: profile.contact_name,
      contact_phone: profile.contact_phone,
    }),
  });
  return normalize(await readResponse<FilingProfile>(response, "保存官网填报资料失败")) || { ...EMPTY_FILING_PROFILE };
}

export { EMPTY_FILING_PROFILE, isFilingProfileComplete };
