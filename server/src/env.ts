import "dotenv/config";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing required server configuration: " + name);
  return value;
}

export const env = {
  port: Number(process.env.PORT || 8787),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "generated-documents",
  encryptionSecret: requireEnv("LLM_KEY_ENCRYPTION_SECRET"),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean),
  pythonBin: process.env.PYTHON_BIN || "python3",
  llmTimeoutMs: Number(process.env.LLM_REQUEST_TIMEOUT_MS || 180_000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  aiRateLimitMax: Number(process.env.AI_RATE_LIMIT_MAX || 30),
};
