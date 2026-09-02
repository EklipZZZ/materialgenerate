import {
  FILING_EXTENSION_SOURCE,
  FILING_PROTOCOL,
  isAppToExtensionMessage,
  isExtensionToAppMessage,
  type AppToExtensionMessage,
  type ExtensionToAppMessage,
} from "../../src/lib/filing-protocol.ts";

const APP_ORIGINS = __SOFTREG_APP_ORIGINS__;
const VERSION = "0.1.0";

function postToPage(message: ExtensionToAppMessage): void {
  const appOrigin = APP_ORIGINS.includes(window.location.origin) ? window.location.origin : null;
  if (appOrigin) window.postMessage(message, appOrigin);
}

function notifyReady(): void {
  postToPage({
    protocol: FILING_PROTOCOL,
    source: FILING_EXTENSION_SOURCE,
    type: "EXTENSION_READY",
    version: VERSION,
  });
}

function isPageMessage(event: MessageEvent): boolean {
  return event.source === window && APP_ORIGINS.includes(event.origin);
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isPageMessage(event) || !isAppToExtensionMessage(event.data)) return;
  const message = event.data as AppToExtensionMessage;
  void chrome.runtime.sendMessage(message).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isExtensionToAppMessage(message)) postToPage(message);
});

notifyReady();
window.setInterval(notifyReady, 5_000);
