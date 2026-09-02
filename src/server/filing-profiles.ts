import { filingProfileInputSchema } from "./api-contracts.ts";
import { getSupabaseAdmin } from "./config";
import { ApiError } from "./http";
import { isFilingProfileComplete, type FilingProfile } from "@/lib/filing-profile";
import type { z } from "zod";

export type FilingProfileInput = z.infer<typeof filingProfileInputSchema>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapProfile(row: Record<string, unknown>): FilingProfile {
  return {
    applicant_address: text(row.applicant_address),
    postal_code: text(row.postal_code),
    contact_name: text(row.contact_name),
    contact_phone: text(row.contact_phone),
  };
}

export async function getOwnedFilingProfile(userId: string): Promise<FilingProfile | null> {
  const result = await getSupabaseAdmin().from("filing_profiles")
    .select("applicant_address,postal_code,contact_name,contact_phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("官网填报资料查询失败");
  return result.data ? mapProfile(result.data as Record<string, unknown>) : null;
}

export async function upsertOwnedFilingProfile(userId: string, input: FilingProfileInput): Promise<FilingProfile> {
  const result = await getSupabaseAdmin().from("filing_profiles")
    .upsert({
      user_id: userId,
      applicant_address: text(input.applicant_address),
      postal_code: text(input.postal_code),
      contact_name: text(input.contact_name),
      contact_phone: text(input.contact_phone),
    }, { onConflict: "user_id" })
    .select("applicant_address,postal_code,contact_name,contact_phone")
    .single();
  if (result.error || !result.data) throw new Error("官网填报资料保存失败");
  return mapProfile(result.data as Record<string, unknown>);
}

export function assertCompleteFilingProfile(profile: FilingProfile | null): asserts profile is FilingProfile {
  if (!isFilingProfileComplete(profile)) throw new ApiError(422, "请先在设置中完善官网填报资料");
}
