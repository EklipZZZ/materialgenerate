"use client";

import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import {
  loadByok,
  saveByok,
  type ByokConfig,
  type SavedLlmConfig,
} from "@/lib/byok";

interface ApiEnvelope<T> {
  data?: T;
}

function asByokConfig(value: SavedLlmConfig): ByokConfig {
  return {
    id: value.id,
    name: value.name,
    provider: value.provider,
    model: value.model,
    keyLast4: value.keyLast4,
  };
}

/**
 * sessionStorage is only a convenience cache. If it is empty (for example in
 * a new tab or after a re-login), hydrate the selected configuration from the
 * server without ever fetching the encrypted API key.
 */
export async function loadPersistedByok(): Promise<ByokConfig | null> {
  const local = loadByok();
  if (local?.id) return local;

  try {
    const response = await authorizedFetch(apiEndpoint("/api/llm-configs"));
    if (!response.ok) return local;
    const body = await response.json().catch(() => ({})) as ApiEnvelope<SavedLlmConfig[]>;
    const selected = body.data?.[0];
    if (!selected) return local;
    const config = asByokConfig(selected);
    saveByok(config);
    return config;
  } catch {
    // A legacy browser value is still returned so the settings page can offer
    // its one-time migration; generation will require a saved server config.
    return local;
  }
}
