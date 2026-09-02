import {
  FILING_EXTENSION_SOURCE,
  FILING_PROTOCOL,
  isFileTransferMessage,
  isFilingManifest,
  type ExtensionToAppMessage,
  type FilingEventCode,
  type FilingManifest,
  type FilingStep,
  type FileTransferMessage,
  type OfficialCommand,
} from "../../src/lib/filing-protocol.ts";
import type { MaterialKind } from "../../src/lib/materials.ts";
import { AdapterError, hasApplicationForm, hasVisibleLoginPrompt, hasUploadControls, R11Adapter } from "./r11-adapter";

type SessionStage = "idle" | "review" | "upload" | "signature" | "done";

interface TransferState {
  jobId: string;
  materialId: string;
  input: HTMLInputElement;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  total: number;
  chunks: Array<string | undefined>;
  timer: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface Session {
  jobId: string;
  manifest: FilingManifest;
  stage: SessionStage;
  navigationClicked: boolean;
  uploaded: Set<string>;
  lastNeedCode: FilingEventCode | null;
}

let session: Session | null = null;
let observer: MutationObserver | null = null;
let scheduledTimer: number | null = null;
let advancing = false;
const transfers = new Map<string, TransferState>();

function sendMessage(message: Record<string, unknown>): void {
  void chrome.runtime.sendMessage({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, ...message }).catch(() => undefined);
}

function sendEvent(event: Exclude<ExtensionToAppMessage, { type: "EXTENSION_READY" }>): void {
  sendMessage({ type: "OFFICIAL_EVENT", event });
}

function progress(step: FilingStep, code: FilingEventCode, value: number): void {
  if (!session) return;
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_PROGRESS", jobId: session.jobId, step, code, progress: Math.max(0, Math.min(100, value)) });
}

function needUser(step: FilingStep, code: FilingEventCode): void {
  if (!session || session.lastNeedCode === code) return;
  session.lastNeedCode = code;
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_NEEDS_USER", jobId: session.jobId, step, code });
}

function fail(code: FilingEventCode, step: FilingStep): void {
  if (!session) return;
  session.lastNeedCode = code;
  session.stage = "done";
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_FAILED", jobId: session.jobId, step, code, retryable: true });
}

function finish(): void {
  if (!session || session.stage === "done") return;
  session.stage = "done";
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_COMPLETED", jobId: session.jobId, step: "completed" });
}

function scheduleAdvance(delay = 250): void {
  if (scheduledTimer !== null) window.clearTimeout(scheduledTimer);
  scheduledTimer = window.setTimeout(() => {
    scheduledTimer = null;
    void advance();
  }, delay);
}

function adapterErrorCode(error: unknown): FilingEventCode {
  if (error instanceof AdapterError) return error.code;
  return "unknown_error";
}

function isOfficialCommand(value: unknown): value is OfficialCommand {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (message.protocol !== FILING_PROTOCOL || message.source !== FILING_EXTENSION_SOURCE || typeof message.jobId !== "string") return false;
  if (message.type === "CANCEL_FILING") return true;
  return (message.type === "BEGIN_FILING" || message.type === "RESUME_FILING") && isFilingManifest(message.manifest);
}

function resetSession(command: Extract<OfficialCommand, { type: "BEGIN_FILING" | "RESUME_FILING" }>): void {
  if (!isFilingManifest(command.manifest)) return;
  if (!session || session.jobId !== command.jobId || command.type === "BEGIN_FILING") {
    session = {
      jobId: command.jobId,
      manifest: command.manifest,
      // A resume may arrive after the official SPA navigated to the upload
      // or signature page and recreated this content script. The presence of
      // an upload area is the only safe signal needed to continue.
      stage: command.type === "RESUME_FILING" && hasUploadControls(document) ? "upload" : "idle",
      navigationClicked: false,
      uploaded: new Set<string>(),
      lastNeedCode: null,
    };
  } else {
    session.manifest = command.manifest;
    session.lastNeedCode = null;
    if (session.stage === "review" || session.stage === "signature") session.stage = "upload";
    else if (session.stage === "done") session.stage = hasUploadControls(document) ? "upload" : "idle";
  }
  scheduleAdvance(50);
}

function cancelSession(jobId: string): void {
  if (session?.jobId !== jobId) return;
  for (const transfer of transfers.values()) {
    window.clearTimeout(transfer.timer);
    transfer.reject(new Error("cancelled"));
  }
  transfers.clear();
  session = null;
  if (scheduledTimer !== null) window.clearTimeout(scheduledTimer);
  scheduledTimer = null;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function attachFile(input: HTMLInputElement, state: TransferState): void {
  const chunks = state.chunks.map((chunk) => chunk ? decodeBase64(chunk) : null);
  if (chunks.some((chunk) => chunk === null)) throw new Error("missing file chunk");
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + (chunk?.byteLength || 0), 0));
  let offset = 0;
  for (const chunk of chunks) {
    if (!chunk) continue;
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes.byteLength !== state.sizeBytes) throw new Error("file size mismatch");
  const file = new File([bytes], state.fileName, { type: state.mimeType || "application/pdf" });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  if (!input.files || input.files.length !== 1 || input.files[0].size !== state.sizeBytes) throw new Error("file input rejected");
}

function receiveFileTransfer(message: FileTransferMessage): void {
  if (!session || message.jobId !== session.jobId) return;
  const state = transfers.get(message.materialId);
  if (message.type === "FILE_TRANSFER_START") {
    if (state) {
      state.fileName = message.fileName;
      state.mimeType = message.mimeType;
      state.sizeBytes = message.sizeBytes;
      return;
    }
    let input: HTMLInputElement;
    try { input = new R11Adapter(document).findUploadInput(session.manifest.materials.find((item) => item.id === message.materialId)?.kind || "source_code_pdf"); }
    catch { return; }
    const transfer: TransferState = {
      jobId: message.jobId,
      materialId: message.materialId,
      input,
      fileName: message.fileName,
      mimeType: message.mimeType,
      sizeBytes: message.sizeBytes,
      total: 0,
      chunks: [],
      timer: 0,
      resolve: () => undefined,
      reject: () => undefined,
    };
    transfers.set(message.materialId, transfer);
    return;
  }
  if (!state) return;
  if (message.type === "FILE_TRANSFER_CHUNK") {
    if (state.total === 0) {
      state.total = message.total;
      state.chunks = new Array(message.total);
    }
    if (message.total !== state.total || message.index < 0 || message.index >= state.total || state.chunks[message.index]) {
      state.reject(new Error("invalid file chunk"));
      transfers.delete(message.materialId);
      return;
    }
    state.chunks[message.index] = message.base64;
    return;
  }
  transfers.delete(message.materialId);
  window.clearTimeout(state.timer);
  try {
    attachFile(state.input, state);
    if (!new R11Adapter(document).uploadAcknowledged(state.input)) throw new Error("official page did not acknowledge file");
    state.resolve();
  } catch (error) {
    state.reject(error instanceof Error ? error : new Error("file upload failed"));
  }
}

function requestFile(materialId: string, input: HTMLInputElement): Promise<void> {
  if (!session) return Promise.reject(new Error("no filing session"));
  const state = session;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      transfers.delete(materialId);
      reject(new Error("file transfer timed out"));
    }, 45_000);
    const pending: TransferState = {
      jobId: state.jobId,
      materialId,
      input,
      fileName: "",
      mimeType: "application/pdf",
      sizeBytes: 0,
      total: 0,
      chunks: [],
      timer,
      resolve: () => { window.clearTimeout(timer); resolve(); },
      reject: (error) => { window.clearTimeout(timer); reject(error); },
    };
    transfers.set(materialId, pending);
    sendMessage({ type: "FILE_REQUEST", jobId: state.jobId, materialId });
  });
}

async function uploadMaterials(adapter: R11Adapter): Promise<void> {
  if (!session) return;
  const order: MaterialKind[] = ["source_code_pdf", "user_manual_pdf", "cooperation_agreement", "commission_agreement", "task_order", "signature_page"];
  const available = order.map((kind) => session?.manifest.materials.find((material) => material.kind === kind)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  for (const [index, material] of available.entries()) {
    if (!session || session.uploaded.has(material.id)) continue;
    let input: HTMLInputElement;
    try { input = adapter.findUploadInput(material.kind); }
    catch (error) {
      fail(adapterErrorCode(error) === "field_not_found" ? "manual_upload_required" : adapterErrorCode(error), "materials");
      return;
    }
    const progressValue = 65 + Math.floor((index / Math.max(1, available.length)) * 30);
    const completedValue = 65 + Math.floor(((index + 1) / Math.max(1, available.length)) * 30);
    if (adapter.uploadAcknowledged(input)) {
      session.uploaded.add(material.id);
      progress("materials", "upload_completed", completedValue);
      continue;
    }
    progress("materials", "upload_started", progressValue);
    try {
      await requestFile(material.id, input);
      if (!session) return;
      session.uploaded.add(material.id);
      progress("materials", "upload_completed", completedValue);
    } catch {
      fail("manual_upload_required", "materials");
      return;
    }
  }
  if (!session) return;
  const hasSignature = session.manifest.materials.some((material) => material.kind === "signature_page");
  if (!hasSignature) {
    session.stage = "signature";
    needUser("signature_page", "signature_page_required");
    return;
  }
  finish();
}

async function advance(): Promise<void> {
  if (!session || advancing || session.stage === "done") return;
  advancing = true;
  try {
    const adapter = new R11Adapter(document);
    if (hasVisibleLoginPrompt(document)) {
      session.stage = "idle";
      needUser("login", "login_required");
      return;
    }
    if (adapter.isLandingPage() && session.stage === "idle") {
      adapter.openR11Entry();
      progress("opening_portal", "portal_opened", 5);
      scheduleAdvance(500);
      return;
    }
    if (session.stage === "idle" && hasApplicationForm(document)) {
      progress("application_form", "form_started", 20);
      try {
        await adapter.fillApplication(session.manifest.application);
      } catch (error) {
        fail(adapterErrorCode(error), "application_form");
        return;
      }
      session.stage = "review";
      progress("application_form", "form_filled", 60);
      needUser("review", "review_required");
      return;
    }
    if (session.stage === "review") return;
    if (session.stage === "upload") {
      if (!hasUploadControls(document)) {
        if (session.navigationClicked) {
          fail("portal_structure_changed", "materials");
          return;
        }
        session.navigationClicked = true;
        try { adapter.clickNextToMaterials(); }
        catch (error) {
          fail(adapterErrorCode(error), "r11_entry");
          return;
        }
        scheduleAdvance(1_200);
        return;
      }
      session.navigationClicked = false;
      await uploadMaterials(adapter);
    }
  } finally {
    advancing = false;
  }
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isFileTransferMessage(message)) {
    receiveFileTransfer(message);
    return;
  }
  if (!isOfficialCommand(message)) return;
  if (message.type === "CANCEL_FILING") cancelSession(message.jobId);
  else resetSession(message);
});

observer = new MutationObserver(() => {
  if (session) scheduleAdvance();
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

sendMessage({ type: "OFFICIAL_READY" });
