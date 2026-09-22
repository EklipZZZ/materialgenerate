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
import {
  AdapterError,
  detectR11Page,
  hasVisibleLoginPrompt,
  hasVisibleValidationErrors,
  hasUploadControls,
  hasApplicationForm,
  hasApplicationPageControls,
  hasDevelopmentPageControls,
  hasFeaturesPageControls,
  type R11Page,
  R11Adapter,
} from "./r11-adapter";

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
  lastPage: R11Page;
  navigationPage: R11Page | null;
  navigationStartedAt: number;
  navigationAttempts: number;
  formStarted: boolean;
  loginPromptSeen: boolean;
  profileFilled: boolean;
  resumeRequested: boolean;
  uploaded: Set<string>;
  lastNeedCode: FilingEventCode | null;
}

let session: Session | null = null;
let observer: MutationObserver | null = null;
let scheduledTimer: number | null = null;
let advancing = false;
const transfers = new Map<string, TransferState>();

const NAVIGATION_WAIT_MS = 2_500;
const NAVIGATION_RETRY_LIMIT = 3;
const PAGE_RETRY_LIMIT = 8;
const PAGE_RETRY_DELAY_MS = 300;
const PAGE_STABILITY_MS = 220;
const NEXT_RETRY_LIMIT = 4;
const NEXT_RETRY_DELAY_MS = 320;
const NEXT_CONTROL_WAIT_MS = 2_500;
const FORM_SETTLE_MS = 520;
const PAGE_READY_TIMEOUT_MS = 15_000;

function sendMessage(message: Record<string, unknown>): void {
  void chrome.runtime.sendMessage({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, ...message }).catch(() => undefined);
}

function sendEvent(event: Exclude<ExtensionToAppMessage, { type: "EXTENSION_READY" }>): void {
  sendMessage({ type: "OFFICIAL_EVENT", event });
}

function progress(step: FilingStep, code: FilingEventCode, value: number, detail?: string): void {
  if (!session) return;
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_PROGRESS", jobId: session.jobId, step, code, progress: Math.max(0, Math.min(100, value)), ...(detail ? { detail } : {}) });
}

function needUser(step: FilingStep, code: FilingEventCode, detail?: string): void {
  if (!session || session.lastNeedCode === code) return;
  session.lastNeedCode = code;
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_NEEDS_USER", jobId: session.jobId, step, code, ...(detail ? { detail } : {}) });
}

function fail(code: FilingEventCode, step: FilingStep, detail?: string): void {
  if (!session) return;
  session.lastNeedCode = code;
  session.stage = "done";
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_FAILED", jobId: session.jobId, step, code, retryable: true, ...(detail ? { detail } : {}) });
}

function finish(): void {
  if (!session || session.stage === "done") return;
  session.stage = "done";
  sendEvent({ protocol: FILING_PROTOCOL, source: FILING_EXTENSION_SOURCE, type: "FILING_COMPLETED", jobId: session.jobId, step: "completed" });
}

function scheduleAdvance(delay = 250, force = false): void {
  // R11 is a Vue SPA and continuously changes classes, validation messages
  // and upload progress attributes. Do not let a MutationObserver callback
  // keep postponing a navigation retry forever. Explicit state-machine
  // transitions may replace the timer; ordinary observer callbacks only
  // create one when no timer is already pending.
  if (scheduledTimer !== null && !force) return;
  if (scheduledTimer !== null) window.clearTimeout(scheduledTimer);
  scheduledTimer = window.setTimeout(() => {
    scheduledTimer = null;
    void advance().catch((error: unknown) => {
      if (session) fail(adapterErrorCode(error), "application_form", `${session.lastPage}.advance`);
    });
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
  const currentPage = detectR11Page(document);
  if (!session || session.jobId !== command.jobId || command.type === "BEGIN_FILING") {
    session = {
      jobId: command.jobId,
      manifest: command.manifest,
      stage: command.type === "RESUME_FILING" && hasUploadControls(document) ? "upload" : "idle",
      lastPage: currentPage,
      navigationPage: null,
      navigationStartedAt: 0,
      navigationAttempts: 0,
      formStarted: false,
      loginPromptSeen: false,
      profileFilled: false,
      resumeRequested: command.type === "RESUME_FILING",
      uploaded: new Set<string>(),
      lastNeedCode: null,
    };
  } else {
    session.manifest = command.manifest;
    session.lastNeedCode = null;
    session.resumeRequested = command.type === "RESUME_FILING";
    session.lastPage = currentPage;
    session.navigationPage = null;
    session.navigationStartedAt = 0;
    session.navigationAttempts = 0;
    session.loginPromptSeen = false;
    if (command.type === "RESUME_FILING") {
      // A resume from the web app means that the user has completed the
      // manual review step. Keep the confirm page untouched; only a genuine
      // materials page or the legacy fixture may enter upload mode here.
      if (currentPage === "materials" || hasUploadControls(document) && currentPage !== "confirm") session.stage = "upload";
      else if (session.stage === "signature") session.stage = "upload";
      else if (currentPage !== "confirm" && currentPage !== "identity") session.stage = "idle";
      else session.stage = "review";
    }
  }
  scheduleAdvance(80, true);
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

async function receiveFileTransfer(message: FileTransferMessage): Promise<void> {
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
  window.clearTimeout(state.timer);
  try {
    attachFile(state.input, state);
    await new R11Adapter(document).waitForUploadAcknowledgement(state.input);
    transfers.delete(message.materialId);
    state.resolve();
  } catch (error) {
    transfers.delete(message.materialId);
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
      fail(adapterErrorCode(error) === "field_not_found" ? "manual_upload_required" : adapterErrorCode(error), "materials", "materials.find_upload");
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
      fail("manual_upload_required", "materials", "materials.file_transfer");
      return;
    }
  }
  if (!session) return;
  const hasSignature = session.manifest.materials.some((material) => material.kind === "signature_page");
  if (!hasSignature) {
    session.stage = "signature";
    needUser("signature_page", "signature_page_required", "signature.manual");
    return;
  }
  finish();
}

function developmentProofKind(method: FilingManifest["application"]["development_method"]): MaterialKind | null {
  if (method === "cooperative") return "cooperation_agreement";
  if (method === "commissioned") return "commission_agreement";
  if (method === "assigned_task") return "task_order";
  return null;
}

async function uploadDevelopmentProof(adapter: R11Adapter): Promise<boolean> {
  if (!session) return false;
  const kind = developmentProofKind(session.manifest.application.development_method);
  if (!kind) return true;
  const material = session.manifest.materials.find((item) => item.kind === kind);
  if (!material) {
    fail("manual_upload_required", "application_form", "development.proof_upload");
    return false;
  }
  if (session.uploaded.has(material.id)) return true;
  let input: HTMLInputElement;
  try {
    input = adapter.findUploadInput(kind);
  } catch (error) {
    fail(adapterErrorCode(error) === "field_not_found" ? "manual_upload_required" : adapterErrorCode(error), "application_form", "development.proof_upload");
    return false;
  }
  if (adapter.uploadAcknowledged(input)) {
    session.uploaded.add(material.id);
    return true;
  }
  progress("application_form", "upload_started", 44);
  try {
    await requestFile(material.id, input);
    if (!session) return false;
    session.uploaded.add(material.id);
    progress("application_form", "upload_completed", 48);
    return true;
  } catch {
    fail("manual_upload_required", "application_form", "development.proof_transfer");
    return false;
  }
}

function pageProgress(page: R11Page): number {
  if (page === "application") return 30;
  if (page === "development") return 50;
  if (page === "features") return 72;
  return 25;
}

async function fillPageWithRetry(adapter: R11Adapter, page: R11Page): Promise<boolean> {
  for (let attempt = 0; attempt <= PAGE_RETRY_LIMIT; attempt += 1) {
    if (!session || detectR11Page(document) !== page) return false;
    try {
      const ready = await waitForPageReady(page);
      if (!ready) {
        // A route transition during the wait is normal; a stable route with
        // no recognizable controls is not. The old silent return made the
        // second page look dead in the web app and gave the user no useful
        // reason to retry.
        if (!session || detectR11Page(document) !== page) return false;
        throw new AdapterError("field_not_found", "官方第二页控件尚未完成渲染");
      }
      await adapter.fillCurrentPage(session?.manifest.application as FilingManifest["application"]);
      return Boolean(session && detectR11Page(document) === page);
    } catch (error) {
      if (detectR11Page(document) !== page) return false;
      if (!(error instanceof AdapterError) || !["field_not_found", "field_verification_failed"].includes(error.code) || attempt === PAGE_RETRY_LIMIT) throw error;
      await new Promise<void>((resolve) => window.setTimeout(resolve, PAGE_RETRY_DELAY_MS));
    }
  }
  return false;
}

async function clickNextWithRetry(adapter: R11Adapter, page: R11Page): Promise<boolean> {
  let deadline = Date.now() + NEXT_CONTROL_WAIT_MS;
  let refillAttempts = 0;
  let lastError: unknown = new AdapterError("field_not_found", "官方页面下一步控件尚未完成渲染");
  while (Date.now() < deadline) {
    if (!session || detectR11Page(document) !== page) return false;
    // R11 validates asynchronously after input/change/blur. Give the current
    // Vue tree a quiet window before asking its own stepNext handler to run.
    await new Promise<void>((resolve) => window.setTimeout(resolve, FORM_SETTLE_MS));
    if (!session || detectR11Page(document) !== page) return false;
    try {
      adapter.clickNext();
      return true;
    } catch (error) {
      if (!(error instanceof AdapterError) || !["field_not_found", "field_verification_failed"].includes(error.code)) throw error;
      lastError = error;
      // A disabled button or a transiently missing button is not enough
      // evidence that the portal structure changed. Give the official page a
      // few polling turns first. If Vue still has not enabled the button,
      // re-fill the same page at most a bounded number of times so its model
      // receives another input/change/blur sequence.
      await new Promise<void>((resolve) => window.setTimeout(resolve, NEXT_RETRY_DELAY_MS));
      if (error.code === "field_verification_failed" && refillAttempts < NEXT_RETRY_LIMIT && Date.now() < deadline) {
        refillAttempts += 1;
        const filled = await fillPageWithRetry(adapter, page);
        if (!filled || !session || detectR11Page(document) !== page) return false;
        // The refill itself can take longer than one polling window. Start a
        // fresh bounded window for the official button to consume the new Vue
        // model value; the total number of refills remains capped above.
        deadline = Date.now() + NEXT_CONTROL_WAIT_MS;
      }
    }
  }
  throw lastError;
}

async function waitForPageTransition(from: R11Page, timeoutMs = NEXT_CONTROL_WAIT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!session) return false;
    const current = detectR11Page(document);
    if (current !== "unknown" && current !== from) return true;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  }
  return false;
}

function pageHasExpectedAnchor(page: R11Page): boolean {
  if (page === "application") return hasApplicationPageControls(document);
  if (page === "legacy") return hasApplicationForm(document);
  if (page === "development") return hasDevelopmentPageControls(document);
  if (page === "features") return hasFeaturesPageControls(document);
  return true;
}

async function waitForPageReady(page: R11Page, timeoutMs = PAGE_READY_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    if (!session || detectR11Page(document) !== page) return false;
    if (pageHasExpectedAnchor(page)) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= PAGE_STABILITY_MS) return true;
    } else {
      stableSince = 0;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  }
  if (!session || detectR11Page(document) !== page) return false;
  throw new AdapterError("field_not_found", "官方页面字段尚未完成渲染");
}

async function handleFormPage(adapter: R11Adapter, page: R11Page): Promise<void> {
  if (!session) return;
  if (session.navigationPage === page) {
    const elapsed = Date.now() - session.navigationStartedAt;
    if (elapsed < NAVIGATION_WAIT_MS) {
      scheduleAdvance(Math.min(500, NAVIGATION_WAIT_MS - elapsed + 50), true);
      return;
    }
    // R11 is a Vue SPA. The native controls may show the value before the
    // component model has consumed the input event, so the first click can
    // leave the route unchanged and render red "不能为空" messages. A
    // bounded re-fill/retry is safe; an unbounded click loop is not.
    if (session.navigationAttempts <= NAVIGATION_RETRY_LIMIT) {
      session.navigationPage = null;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 320));
    } else {
      fail(hasVisibleValidationErrors(document) ? "field_verification_failed" : "portal_structure_changed", "application_form", `${page}.navigation`);
      return;
    }
  }

  if (!session.formStarted) session.formStarted = true;
  // Report every form page, not only the first one. This makes a slow Vue
  // route transition visible in the web app instead of looking like the
  // extension stopped after page one.
  progress("application_form", "form_started", pageProgress(page), `${page}.start`);
  try {
    const filled = await fillPageWithRetry(adapter, page);
    if (!filled || !session || detectR11Page(document) !== page) return;
  } catch (error) {
    fail(adapterErrorCode(error), "application_form", adapter.diagnosticOperation());
    return;
  }
  if (!session) return;
  if (page === "legacy") {
    session.stage = "review";
    session.resumeRequested = false;
    progress("application_form", "form_filled", 60, "application.review");
    needUser("review", "review_required", "application.review");
    return;
  }
  if (page === "development" && !await uploadDevelopmentProof(adapter)) return;
  if (!session || detectR11Page(document) !== page) return;
  let transitioned = false;
  try {
    const clicked = await clickNextWithRetry(adapter, page);
    if (!clicked || !session) return;
    // Observe the route directly as well as through MutationObserver. The
    // portal's next-step handler is async and may change the hash before it
    // renders the next Vue page; waiting here makes the normal transition
    // deterministic and leaves the bounded retry path only for validation.
    transitioned = await waitForPageTransition(page);
    if (!session) return;
  } catch (error) {
    fail(adapterErrorCode(error), "application_form", `${page}.next`);
    return;
  }
  session.lastPage = page;
  session.navigationPage = page;
  session.navigationStartedAt = Date.now();
  session.navigationAttempts += 1;
  progress("application_form", "form_filled", pageProgress(page), `${page}.filled`);
  scheduleAdvance(transitioned ? 120 : 900, true);
}

async function advance(): Promise<void> {
  if (!session || advancing || session.stage === "done") return;
  // MutationObserver callbacks can be queued while the page is being filled
  // and run just after the state changes to a manual checkpoint. Never start
  // the same page again until the user explicitly resumes the job; doing so
  // used to make a correctly filled form look like a second failed attempt.
  if ((session.stage === "review" || session.stage === "signature") && !session.resumeRequested) return;
  advancing = true;
  try {
    const adapter = new R11Adapter(document);
    if (hasVisibleLoginPrompt(document)) {
      session.stage = "idle";
      session.loginPromptSeen = true;
      needUser("login", "login_required", "login.manual");
      return;
    }
    if (session.loginPromptSeen) {
      session.loginPromptSeen = false;
      session.lastNeedCode = null;
      progress("login", "login_detected", 10);
    }

    if (!session.profileFilled) {
      try {
        session.profileFilled = await adapter.fillFilingProfile(session.manifest.filingProfile);
      } catch (error) {
        fail(adapterErrorCode(error), "application_form", "filing_profile.fill");
        return;
      }
    }

    if (adapter.isLandingPage() && session.stage === "idle") {
      adapter.openR11Entry();
      progress("opening_portal", "portal_opened", 5);
      scheduleAdvance(800, true);
      return;
    }

    const page = detectR11Page(document);
    if (session.navigationPage && page !== session.navigationPage) {
      session.navigationPage = null;
      session.navigationAttempts = 0;
      session.lastNeedCode = null;
    }
    session.lastPage = page;

    if (page === "identity") {
      session.stage = "idle";
      needUser("login", "login_required", "login.manual");
      return;
    }
    if (page === "confirm") {
      session.stage = "review";
      session.resumeRequested = false;
      progress("review", "form_filled", 75);
      needUser("review", "review_required", "review.manual");
      return;
    }
    if (page === "materials") {
      if (!session.resumeRequested && session.stage !== "upload") {
        // Reaching the material page from the official confirmation action is
        // still a manual checkpoint. Wait for the web app's RESUME_FILING so
        // the user can finish the official review before files are uploaded.
        session.stage = "review";
        needUser("review", "review_required", "review.manual");
        return;
      }
      session.stage = "upload";
      await uploadMaterials(adapter);
      return;
    }
    if ((page === "application" || page === "development" || page === "features" || page === "legacy") && session.stage !== "review" && session.stage !== "upload") {
      await handleFormPage(adapter, page);
      return;
    }
    if (session.stage === "review") return;
    if (session.stage === "upload") {
      if (!hasUploadControls(document)) {
        // At the real /confirm route the “提交材料清单” action may be the
        // gateway to the file page. It is intentionally left to the user so
        // that the extension cannot mistake it for final submission.
        needUser("review", "review_required", "review.manual");
        return;
      }
      await uploadMaterials(adapter);
    }
  } finally {
    advancing = false;
  }
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isFileTransferMessage(message)) {
    void receiveFileTransfer(message);
    return;
  }
  if (!isOfficialCommand(message)) return;
  if (message.type === "CANCEL_FILING") cancelSession(message.jobId);
  else resetSession(message);
});

observer = new MutationObserver(() => {
  if (!session || advancing) return;
  // A route transition is a high-priority wake-up. Otherwise keep the
  // currently scheduled state-machine timer intact while Vue settles.
  const currentPage = detectR11Page(document);
  const routeChanged = currentPage !== "unknown" && currentPage !== session.lastPage;
  scheduleAdvance(routeChanged ? 120 : 250, routeChanged);
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

sendMessage({ type: "OFFICIAL_READY" });
