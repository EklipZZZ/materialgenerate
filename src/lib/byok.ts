export type Provider = "openai" | "deepseek";

export const providerModels = {
  openai: ["gpt-5-mini", "gpt-5.1"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
} as const;

/**
 * The optional apiKey is only used while migrating the old sessionStorage value.
 * A saved configuration always has an id and never stores the full key here.
 */
export interface ByokConfig {
  id?: string;
  name?: string;
  provider: Provider;
  model: string;
  keyLast4?: string;
  apiKey?: string;
}

export interface SavedLlmConfig {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  keyLast4: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = "materialgenerate.llm-config.v2";
const LEGACY_STORAGE_KEY = "materialgenerate.byok.v1";

function validProvider(value: unknown): value is Provider {
  return value === "openai" || value === "deepseek";
}

function readMetadata(raw: string): ByokConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ByokConfig>;
    if (!parsed.id || !validProvider(parsed.provider) || !parsed.model || !parsed.keyLast4) return null;
    return {
      id: parsed.id,
      name: parsed.name || "AI 配置",
      provider: parsed.provider,
      model: parsed.model,
      keyLast4: parsed.keyLast4,
    };
  } catch {
    return null;
  }
}

export function loadByok(): ByokConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    const metadata = saved ? readMetadata(saved) : null;
    if (metadata) return metadata;
    // Read the old value only to let the settings page migrate it once.
    const legacy = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as Partial<ByokConfig>;
    if (!validProvider(parsed.provider) || !parsed.model || !parsed.apiKey) return null;
    return { provider: parsed.provider, model: parsed.model, apiKey: parsed.apiKey };
  } catch {
    return null;
  }
}

export function saveByok(value: ByokConfig | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value?.id || !value.keyLast4) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      id: value.id,
      name: value.name || "AI 配置",
      provider: value.provider,
      model: value.model,
      keyLast4: value.keyLast4,
    }));
  } catch {
    // The server-side configuration remains authoritative if storage is disabled.
  }
}

export function clearLegacyByok(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore disabled storage.
  }
}
