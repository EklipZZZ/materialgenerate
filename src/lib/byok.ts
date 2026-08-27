export type Provider = "openai" | "deepseek";

export const providerModels = {
  openai: ["gpt-5-mini", "gpt-5.1"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
} as const;

export interface ByokConfig {
  provider: Provider;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = "materialgenerate.byok.v1";

export function loadByok(): ByokConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ByokConfig>;
    if ((parsed.provider !== "openai" && parsed.provider !== "deepseek") || !parsed.model || !parsed.apiKey) return null;
    return { provider: parsed.provider, model: parsed.model, apiKey: parsed.apiKey };
  } catch {
    return null;
  }
}

export function saveByok(value: ByokConfig | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Session storage may be disabled; the in-memory React state still works.
  }
}
