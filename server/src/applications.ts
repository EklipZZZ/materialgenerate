import { supabaseAdmin } from "./db.js";

export interface ApplicationRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  status: string;
  enriched_data?: Record<string, unknown> | null;
}

export function effectiveApplication(row: ApplicationRow) {
  const enriched = row.enriched_data;
  const effectiveForm = row.status === "enriched" && enriched && typeof enriched === "object"
    ? { ...row, ...enriched }
    : row;
  return { ...row, effective_form: effectiveForm };
}

export async function getOwnedApplication(
  applicationId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ApplicationRow | null> {
  const query = supabaseAdmin
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
  const query = supabaseAdmin
    .from("applications")
    .update({
      enriched_data: enrichedData,
      status: "enriched",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("user_id", userId)
    .select("*");
  if (signal) query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("application enrichment update failed");
  return data as ApplicationRow | null;
}
