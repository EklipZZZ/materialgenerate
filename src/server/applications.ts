import { z } from "zod";
import { getSupabaseAdmin } from "./config";
import { formFields } from "./form";

const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(20_000);

export const applicationFields = z.object({
  software_full_name: shortText.optional(),
  software_short_name: shortText.optional(),
  version: shortText.optional(),
  software_category: shortText.optional(),
  development_date: z.string().trim().max(40).optional(),
  is_published: z.boolean().optional(),
  development_hardware: longText.optional(),
  runtime_hardware: longText.optional(),
  development_os: longText.optional(),
  development_tools: longText.optional(),
  runtime_platform: longText.optional(),
  runtime_environment: longText.optional(),
  programming_language: longText.optional(),
  source_code_lines: z.number().int().min(0).max(1_000_000_000).optional(),
  development_purpose: longText.optional(),
  target_industry: longText.optional(),
  main_functions: longText.optional(),
  technical_features: longText.optional(),
  company_name: shortText.optional(),
  credit_code: shortText.optional(),
}).strict();

export const applicationIdSchema = z.string().uuid();

export interface ApplicationRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  status: string;
  enriched_data?: Record<string, unknown> | null;
}

export function effectiveApplication(row: ApplicationRow) {
  const enriched = row.enriched_data;
  const effectiveForm = enriched && typeof enriched === "object"
    ? { ...row, ...enriched }
    : row;
  return { ...row, effective_form: effectiveForm };
}

export async function getOwnedApplication(
  applicationId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ApplicationRow | null> {
  const query = getSupabaseAdmin()
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("user_id", userId);
  if (signal) query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("application lookup failed");
  return data as ApplicationRow | null;
}

export async function saveOwnedApplicationEnrichment(
  applicationId: string,
  userId: string,
  enrichedData: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ApplicationRow | null> {
  const query = getSupabaseAdmin()
    .from("applications")
    .update({ enriched_data: enrichedData, status: "enriched", updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("user_id", userId)
    .select("*");
  if (signal) query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("application enrichment update failed");
  return data as ApplicationRow | null;
}

export function sanitizeApplicationPayload(value: unknown) {
  return applicationFields.safeParse(value);
}

export function applicationFormKeys(): readonly string[] {
  return formFields;
}
