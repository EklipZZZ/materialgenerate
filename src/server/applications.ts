import { z } from "zod";
import { getSupabaseAdmin } from "./config";
import { formFields } from "./form";
import {
  applicationFields,
  applicationIdSchema,
  applicationPayloadFields,
  copyrightHolderFields,
} from "./api-contracts.ts";

export {
  applicationFields,
  applicationIdSchema,
  applicationPayloadFields,
  copyrightHolderFields,
};

export interface CopyrightHolderRow {
  id: string;
  user_id: string;
  application_id: string;
  holder_type: "person" | "organization";
  name: string;
  category: string;
  document_type: string;
  document_number: string;
  nationality: string;
  province: string;
  city: string;
  park?: string | null;
  birth_or_established_date?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApplicationRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  status: string;
  enriched_data?: Record<string, unknown> | null;
  copyright_holders?: CopyrightHolderRow[];
}

export interface SplitApplicationPayload {
  columns: Record<string, unknown>;
  holders?: Array<z.infer<typeof copyrightHolderFields>>;
}

function normalizeHolders(holders: Array<z.infer<typeof copyrightHolderFields>>) {
  return holders.map((holder, index) => ({
    ...holder,
    sort_order: index,
  }));
}

export function splitApplicationPayload(value: unknown) {
  const parsed = applicationPayloadFields.safeParse(value);
  if (!parsed.success) return parsed;
  const { copyright_holders: rawHolders, ...columns } = parsed.data;
  const holders = rawHolders === undefined ? undefined : normalizeHolders(rawHolders);
  const firstOrganization = holders?.find((holder) => holder.holder_type === "organization");

  // Keep the legacy columns synchronized without overriding an explicit old value.
  if (firstOrganization) {
    if (!String(columns.company_name || "").trim()) columns.company_name = firstOrganization.name;
    if (!String(columns.credit_code || "").trim()) columns.credit_code = firstOrganization.document_number;
  }
  return { success: true as const, data: { columns, holders } };
}

export function effectiveApplication(row: ApplicationRow) {
  const enriched = row.enriched_data;
  const effectiveForm = enriched && typeof enriched === "object"
    ? { ...row, ...enriched }
    : row;
  return { ...row, effective_form: effectiveForm };
}

async function loadApplicationHolders(applicationId: string, userId: string): Promise<CopyrightHolderRow[]> {
  const result = await getSupabaseAdmin()
    .from("copyright_holders")
    .select("*")
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (result.error) throw new Error("copyright holder lookup failed");
  return (result.data || []) as CopyrightHolderRow[];
}

async function attachHolders(row: ApplicationRow, userId: string): Promise<ApplicationRow> {
  return { ...row, copyright_holders: await loadApplicationHolders(row.id, userId) };
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
  return data ? attachHolders(data as ApplicationRow, userId) : null;
}

export async function getOwnedApplications(userId: string): Promise<ApplicationRow[]> {
  const result = await getSupabaseAdmin()
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error("application lookup failed");
  const rows = (result.data || []) as ApplicationRow[];
  if (!rows.length) return [];
  const holders = await getSupabaseAdmin()
    .from("copyright_holders")
    .select("*")
    .eq("user_id", userId)
    .in("application_id", rows.map((row) => row.id))
    .order("sort_order", { ascending: true });
  if (holders.error) throw new Error("copyright holder lookup failed");
  const grouped = new Map<string, CopyrightHolderRow[]>();
  for (const holder of (holders.data || []) as CopyrightHolderRow[]) {
    const current = grouped.get(holder.application_id) || [];
    current.push(holder);
    grouped.set(holder.application_id, current);
  }
  return rows.map((row) => ({ ...row, copyright_holders: grouped.get(row.id) || [] }));
}

export async function replaceOwnedHolders(
  applicationId: string,
  userId: string,
  holders: Array<z.infer<typeof copyrightHolderFields>>,
): Promise<void> {
  const client = getSupabaseAdmin();
  const deleted = await client
    .from("copyright_holders")
    .delete()
    .eq("application_id", applicationId)
    .eq("user_id", userId);
  if (deleted.error) throw new Error("copyright holder replacement failed");
  if (!holders.length) return;
  const inserted = await client.from("copyright_holders").insert(
    normalizeHolders(holders).map((holder) => {
      const holderPayload = { ...holder };
      delete holderPayload.id;
      return {
        ...holderPayload,
        user_id: userId,
        application_id: applicationId,
      };
    }),
  );
  if (inserted.error) throw new Error("copyright holder replacement failed");
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
  return data ? attachHolders(data as ApplicationRow, userId) : null;
}

export function sanitizeApplicationPayload(value: unknown) {
  return splitApplicationPayload(value);
}

export function applicationFormKeys(): readonly string[] {
  return formFields;
}
