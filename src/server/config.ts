import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ServerEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  storageBucket: string;
  converterSecret: string;
  docxPdfConverterUrl?: string;
  llmConfigEncryptionKey: string;
  pythonBin: string;
  llmTimeoutMs: number;
  generationJobStaleMs: number;
}

let cachedEnv: ServerEnv | null = null;
let cachedAdmin: SupabaseClient | null = null;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error("Missing required server configuration: " + name);
  return value;
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;
  const generationJobStaleMs = Number(process.env.GENERATION_JOB_STALE_MS || 6 * 60 * 1000);
  cachedEnv = {
    supabaseUrl: required("SUPABASE_URL", process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "generated-documents",
    converterSecret: required("CONVERTER_SHARED_SECRET", process.env.CONVERTER_SHARED_SECRET),
    docxPdfConverterUrl: process.env.DOCX_PDF_CONVERTER_URL?.replace(/\/$/, ""),
    llmConfigEncryptionKey: required("LLM_CONFIG_ENCRYPTION_KEY", process.env.LLM_CONFIG_ENCRYPTION_KEY),
    pythonBin: process.env.PYTHON_BIN || "python3",
    llmTimeoutMs: Number(process.env.LLM_REQUEST_TIMEOUT_MS || 120_000),
    generationJobStaleMs: Number.isFinite(generationJobStaleMs) && generationJobStaleMs > 0
      ? generationJobStaleMs
      : 6 * 60 * 1000,
  };
  return cachedEnv;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const env = getServerEnv();
  cachedAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}
