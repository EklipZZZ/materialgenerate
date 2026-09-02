import {
  FILING_EXTENSION_SOURCE,
  FILING_PROTOCOL,
  R11_URL,
  isAppToExtensionMessage,
  isExtensionToAppMessage,
  isFileTransferMessage,
  type AppToExtensionMessage,
  type ExtensionToAppMessage,
  type FilingEventCode,
  type FilingStep,
  type FilingManifest,
  type OfficialCommand,
} from "../../src/lib/filing-protocol.ts";

const APP_ORIGINS = __SOFTREG_APP_ORIGINS__;
const STORAGE_ORIGIN = __SOFTREG_STORAGE_ORIGIN__;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const CHUNK_BYTES = 256 * 1024;

interface FilingState {
  jobId: string;
  appTabId: number;
  officialTabId: number | null;
  manifest: FilingManifest;
  command: "BEGIN_FILING" | "RESUME_FILING";
}

const states = new Map<string, FilingState>();

function tabUrl(sender: chrome.runtime.MessageSender): string {
  return sender.tab?.url || sender.url || "";
}

function isAppSender(sender: chrome.runtime.MessageSender): boolean {
  try { return APP_ORIGINS.includes(new URL(tabUrl(sender)).origin); } catch { return false; }
}

function isOfficialSender(sender: chrome.runtime.MessageSender): boolean {
  try {
    const url = new URL(tabUrl(sender));
    return url.protocol === "https:" && url.hostname === "register.ccopyright.com.cn";
  } catch {
    return false;
  }
}

function eventMessage(input: {
  type: Exclude<ExtensionToAppMessage["type"], "EXTENSION_READY">;
  jobId: string;
  step: FilingStep;
  code: FilingEventCode;
  progress?: number;
  retryable?: boolean;
}): ExtensionToAppMessage {
  if (input.type === "FILING_PROGRESS") return {
    protocol: FILING_PROTOCOL,
    source: FILING_EXTENSION_SOURCE,
    type: input.type,
    jobId: input.jobId,
    step: input.step,
    code: input.code,
    progress: input.progress ?? 0,
  };
  if (input.type === "FILING_NEEDS_USER") return {
    protocol: FILING_PROTOCOL,
    source: FILING_EXTENSION_SOURCE,
    type: input.type,
    jobId: input.jobId,
    step: input.step,
    code: input.code,
  };
  if (input.type === "FILING_COMPLETED") return {
    protocol: FILING_PROTOCOL,
    source: FILING_EXTENSION_SOURCE,
    type: input.type,
    jobId: input.jobId,
    step: "completed",
  };
  return {
    protocol: FILING_PROTOCOL,
    source: FILING_EXTENSION_SOURCE,
    type: "FILING_FAILED",
    jobId: input.jobId,
    step: input.step,
    code: input.code,
    retryable: input.retryable ?? true,
  };
}

async function sendToApp(state: FilingState, message: ExtensionToAppMessage): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(state.appTabId, message);
    return true;
  } catch {
    // The app tab may be reloading. Keep the in-memory state until the tab is
    // actually removed so a later official event can be delivered after the
    // bridge content script reconnects; the app can also explicitly resume.
    return false;
  }
}

async function sendOfficialCommand(state: FilingState): Promise<void> {
  if (state.officialTabId === null) return;
  const command: OfficialCommand = state.command === "BEGIN_FILING"
    ? { protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "BEGIN_FILING", jobId: state.jobId, manifest: state.manifest }
    : { protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "RESUME_FILING", jobId: state.jobId, manifest: state.manifest };
  try {
    await chrome.tabs.sendMessage(state.officialTabId, command);
  } catch {
    // The static content script may not have loaded yet. tabs.onUpdated and
    // OFFICIAL_READY retry the command without exposing a page error to the user.
  }
}

async function findOrOpenOfficial(state: FilingState): Promise<void> {
  if (state.officialTabId !== null) {
    try {
      await chrome.tabs.get(state.officialTabId);
      await sendOfficialCommand(state);
      return;
    } catch {
      state.officialTabId = null;
    }
  }
  try {
    const tab = await chrome.tabs.create({ url: R11_URL, active: true });
    if (typeof tab.id !== "number") throw new Error("official tab unavailable");
    state.officialTabId = tab.id;
    await sendToApp(state, eventMessage({
      type: "FILING_PROGRESS",
      jobId: state.jobId,
      step: "opening_portal",
      code: "portal_opened",
      progress: 5,
    }));
  } catch {
    await sendToApp(state, eventMessage({
      type: "FILING_FAILED",
      jobId: state.jobId,
      step: "opening_portal",
      code: "unknown_error",
      retryable: true,
    }));
  }
}

function stateForJob(jobId: string): FilingState | undefined {
  return states.get(jobId);
}

function stateForOfficialTab(tabId: number): FilingState | undefined {
  for (const state of states.values()) if (state.officialTabId === tabId) return state;
  return undefined;
}

function stateForAppTab(tabId: number): FilingState | undefined {
  for (const state of states.values()) if (state.appTabId === tabId) return state;
  return undefined;
}

async function beginFromApp(message: AppToExtensionMessage, sender: chrome.runtime.MessageSender): Promise<void> {
  if (!isAppSender(sender) || !isAppToExtensionMessage(message)) return;
  if (message.type === "CANCEL_FILING") return;
  const existing = stateForJob(message.manifest.jobId);
  const state: FilingState = existing || {
    jobId: message.manifest.jobId,
    appTabId: sender.tab?.id ?? -1,
    officialTabId: null,
    manifest: message.manifest,
    command: message.type === "START_FILING" ? "BEGIN_FILING" : "RESUME_FILING",
  };
  if (state.appTabId < 0) return;
  state.appTabId = sender.tab?.id ?? state.appTabId;
  state.manifest = message.manifest;
  state.command = message.type === "START_FILING" ? "BEGIN_FILING" : "RESUME_FILING";
  states.set(state.jobId, state);
  await findOrOpenOfficial(state);
  await sendOfficialCommand(state);
}

async function cancelFromApp(message: AppToExtensionMessage, sender: chrome.runtime.MessageSender): Promise<void> {
  if (!isAppSender(sender) || message.type !== "CANCEL_FILING") return;
  const state = stateForJob(message.jobId);
  if (!state || state.appTabId !== sender.tab?.id) return;
  if (state.officialTabId !== null) {
    try {
      await chrome.tabs.sendMessage(state.officialTabId, {
        protocol: FILING_PROTOCOL,
        source: FILING_EXTENSION_SOURCE,
        type: "CANCEL_FILING",
        jobId: state.jobId,
      } satisfies OfficialCommand);
    } catch {
      // The official tab may already be closed.
    }
  }
  states.delete(state.jobId);
}

async function fetchMaterial(state: FilingState, materialId: string, sender: chrome.runtime.MessageSender): Promise<void> {
  if (!isOfficialSender(sender) || sender.tab?.id === undefined || sender.tab.id !== state.officialTabId) return;
  const material = state.manifest.materials.find((item) => item.id === materialId);
  if (!material) {
    await sendToApp(state, eventMessage({ type: "FILING_FAILED", jobId: state.jobId, step: "materials", code: "manual_upload_required", retryable: true }));
    return;
  }
  let url: URL;
  try { url = new URL(material.downloadUrl); } catch { url = new URL("https://invalid.local"); }
  if (url.origin !== STORAGE_ORIGIN || url.protocol !== "https:") {
    await sendToApp(state, eventMessage({ type: "FILING_FAILED", jobId: state.jobId, step: "materials", code: "manual_upload_required", retryable: true }));
    return;
  }
  try {
    const response = await fetch(url.toString(), { method: "GET", credentials: "omit", cache: "no-store" });
    if (!response.ok) throw new Error("download failed");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES) throw new Error("file too large");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES || (material.sizeBytes !== null && buffer.byteLength !== material.sizeBytes)) throw new Error("file size mismatch");
    const bytes = new Uint8Array(buffer);
    const total = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_BYTES));
    await chrome.tabs.sendMessage(state.officialTabId, {
      protocol: FILING_PROTOCOL,
      source: FILING_EXTENSION_SOURCE,
      type: "FILE_TRANSFER_START",
      jobId: state.jobId,
      materialId,
      fileName: material.fileName,
      mimeType: material.mimeType,
      sizeBytes: bytes.byteLength,
    });
    for (let index = 0; index < total; index += 1) {
      const chunk = bytes.slice(index * CHUNK_BYTES, Math.min(bytes.length, (index + 1) * CHUNK_BYTES));
      await chrome.tabs.sendMessage(state.officialTabId, {
        protocol: FILING_PROTOCOL,
        source: FILING_EXTENSION_SOURCE,
        type: "FILE_TRANSFER_CHUNK",
        jobId: state.jobId,
        materialId,
        index,
        total,
        base64: bytesToBase64(chunk),
      });
    }
    await chrome.tabs.sendMessage(state.officialTabId, {
      protocol: FILING_PROTOCOL,
      source: FILING_EXTENSION_SOURCE,
      type: "FILE_TRANSFER_END",
      jobId: state.jobId,
      materialId,
    });
  } catch {
    await sendToApp(state, eventMessage({ type: "FILING_FAILED", jobId: state.jobId, step: "materials", code: "manual_upload_required", retryable: true }));
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

async function handleMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<void> {
  if (isAppToExtensionMessage(message)) {
    if (message.type === "CANCEL_FILING") await cancelFromApp(message, sender);
    else await beginFromApp(message, sender);
    return;
  }
  if (!message || typeof message !== "object") return;
  const candidate = message as Record<string, unknown>;
  if (candidate.protocol !== FILING_PROTOCOL || candidate.source !== FILING_EXTENSION_SOURCE) return;
  if (candidate.type === "OFFICIAL_READY") {
    if (!isOfficialSender(sender) || sender.tab?.id === undefined) return;
    const state = stateForOfficialTab(sender.tab.id);
    if (state) await sendOfficialCommand(state);
    return;
  }
  if (candidate.type === "OFFICIAL_EVENT") {
    if (!isOfficialSender(sender) || sender.tab?.id === undefined) return;
    const state = stateForOfficialTab(sender.tab.id);
    const event = candidate.event;
    if (!state || !isExtensionToAppMessage(event)) return;
    if (event.type === "EXTENSION_READY" || event.jobId !== state.jobId) return;
    const delivered = await sendToApp(state, event);
    if (delivered && (event.type === "FILING_COMPLETED" || event.type === "FILING_FAILED")) states.delete(state.jobId);
    return;
  }
  if (candidate.type === "FILE_REQUEST" && typeof candidate.jobId === "string" && typeof candidate.materialId === "string") {
    const state = stateForJob(candidate.jobId);
    if (state) await fetchMaterial(state, candidate.materialId, sender);
    return;
  }
  if (isFileTransferMessage(message)) return;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  void handleMessage(message, sender);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  const state = stateForOfficialTab(tabId);
  if (state) void sendOfficialCommand(state);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const official = stateForOfficialTab(tabId);
  if (official) {
    official.officialTabId = null;
    void sendToApp(official, eventMessage({ type: "FILING_FAILED", jobId: official.jobId, step: "waiting_user", code: "extension_disconnected", retryable: true })).then((delivered) => {
      if (delivered) states.delete(official.jobId);
    });
    return;
  }
  const app = stateForAppTab(tabId);
  if (app) states.delete(app.jobId);
});
