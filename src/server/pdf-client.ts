import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getServerEnv } from "./config";
import { DocumentConversionError } from "./converter";
import type { PdfRenderResult } from "./pdf-generator";

const PDF_CONVERSION_TIMEOUT_MS = 150_000;
const CONVERTER_WAKE_TIMEOUT_MS = 120_000;
const CONVERTER_HEALTH_TIMEOUT_MS = 10_000;
const CONVERTER_WAKE_POLL_MS = 3_000;
const REMOTE_RETRY_DELAYS_MS = [5_000, 10_000, 15_000, 20_000, 20_000, 20_000, 20_000];
const MAX_PDF_BYTES = 30 * 1024 * 1024;

export class PdfConversionError extends DocumentConversionError {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PdfConversionError";
    this.status = status;
  }
}

function responseDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; msg?: unknown };
    const detail = parsed.detail ?? parsed.msg;
    return typeof detail === "string" ? detail.slice(0, 200) : "";
  } catch {
    return body.trim().replace(/\s+/g, " ").slice(0, 200);
  }
}

function assertPdf(buffer: Buffer): void {
  if (buffer.length < 1_000 || buffer.length > MAX_PDF_BYTES) {
    throw new PdfConversionError("PDF 转换结果大小异常");
  }
  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")) || !buffer.subarray(-2048).includes(Buffer.from("%%EOF"))) {
    throw new PdfConversionError("PDF 转换服务未返回有效 PDF");
  }
}

function inferredPageCount(buffer: Buffer): number {
  return Math.max(1, buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length || 0);
}

function combinedSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function snapDeployWakeUrl(converterUrl: string): string | null {
  const url = new URL(converterUrl);
  const productionSuffix = ".containers.snapdeploy.app";
  const developmentSuffix = ".containers-dev.snapdeploy.app";
  const legacyDevelopmentSuffix = ".containers.somdip.dev";
  const suffix = [productionSuffix, developmentSuffix, legacyDevelopmentSuffix]
    .find((candidate) => url.hostname.endsWith(candidate));
  if (!suffix) return null;
  const subdomain = url.hostname.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes(".")) return null;
  const platformOrigin = suffix === productionSuffix ? "https://snapdeploy.dev" : "https://containers.somdip.dev";
  return `${platformOrigin}/api/public/wake/${encodeURIComponent(subdomain)}`;
}

async function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason ?? new Error("PDF conversion retry cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

async function converterHealthStatus(converterUrl: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(`${converterUrl}/health`, {
      method: "GET",
      cache: "no-store",
      signal: combinedSignal(signal, CONVERTER_HEALTH_TIMEOUT_MS),
    });
    return response.status;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

export async function ensureRemoteConverterReady(signal?: AbortSignal): Promise<void> {
  const converterUrl = getServerEnv().docxPdfConverterUrl;
  if (!converterUrl) {
    throw new PdfConversionError("未配置 DOCX_PDF_CONVERTER_URL，正式 PDF 已停止使用旧排版器");
  }
  const initialStatus = await converterHealthStatus(converterUrl, signal);
  if (initialStatus === 200) return;
  const wakeUrl = snapDeployWakeUrl(converterUrl);
  if (!wakeUrl) {
    throw new PdfConversionError(
      initialStatus
        ? `PDF 转换服务健康检查异常（HTTP ${initialStatus}）`
        : "PDF 转换服务健康检查连接失败",
      initialStatus || undefined,
    );
  }

  const wakeStartedAt = Date.now();
  let wakeStatus: number;
  try {
    const response = await fetch(wakeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: combinedSignal(signal, CONVERTER_HEALTH_TIMEOUT_MS),
    });
    wakeStatus = response.status;
    if (wakeStatus === 402) {
      throw new PdfConversionError("SnapDeploy 免费容器当前无法唤醒，请在控制台检查用量或容器状态", wakeStatus);
    }
    if (![200, 202, 409, 429].includes(wakeStatus)) {
      throw new PdfConversionError(`SnapDeploy 容器唤醒请求失败（HTTP ${wakeStatus}）`, wakeStatus);
    }
  } catch (error) {
    if (error instanceof PdfConversionError || signal?.aborted) throw error;
    throw new PdfConversionError("无法向 SnapDeploy 发送容器唤醒请求");
  }
  console.info("PDF converter wake requested", { provider: "snapdeploy", status: wakeStatus });

  const wakeSignal = combinedSignal(signal, CONVERTER_WAKE_TIMEOUT_MS);
  while (!wakeSignal.aborted) {
    try {
      await waitForRetry(CONVERTER_WAKE_POLL_MS, wakeSignal);
    } catch (error) {
      if (signal?.aborted) throw error;
      break;
    }
    const status = await converterHealthStatus(converterUrl, wakeSignal);
    if (status === 200) {
      console.info("PDF converter ready", {
        provider: "snapdeploy",
        wakeDurationMs: Date.now() - wakeStartedAt,
      });
      return;
    }
  }
  throw new PdfConversionError("SnapDeploy 容器已请求唤醒，但在 120 秒内仍未就绪");
}

function localSofficePath(): string {
  if (process.env.LIBREOFFICE_BIN) return process.env.LIBREOFFICE_BIN;
  return process.platform === "win32" ? "C:\\Program Files\\LibreOffice\\program\\soffice.com" : "soffice";
}

async function localDocxToPdf(docx: Buffer, signal?: AbortSignal): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "materialgenerate-pdf-"));
  const inputPath = join(directory, "input.docx");
  const outputPath = join(directory, "input.pdf");
  const profilePath = join(directory, "lo-profile");
  try {
    await writeFile(inputPath, docx);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(localSofficePath(), [
        "--headless", "--nologo", "--nodefault", "--nolockcheck", "--nofirststartwizard",
        `-env:UserInstallation=${pathToFileURL(profilePath).toString()}`,
        "--convert-to", "pdf:writer_pdf_Export", "--outdir", directory, inputPath,
      ], { stdio: ["ignore", "ignore", "pipe"], signal });
      const timer = setTimeout(() => child.kill(), PDF_CONVERSION_TIMEOUT_MS);
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve() : reject(new PdfConversionError("LibreOffice PDF 转换失败")));
      child.on("exit", () => clearTimeout(timer));
    });
    const pdf = await readFile(outputPath);
    assertPdf(pdf);
    return pdf;
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function remoteDocxToPdf(docx: Buffer, signal?: AbortSignal): Promise<{ buffer: Buffer; pageCount: number }> {
  const env = getServerEnv();
  if (!env.docxPdfConverterUrl) {
    throw new PdfConversionError("未配置 DOCX_PDF_CONVERTER_URL，正式 PDF 已停止使用旧排版器");
  }
  let lastError: unknown;
  const timeoutSignal = AbortSignal.timeout(PDF_CONVERSION_TIMEOUT_MS + 90_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  for (let attempt = 0; attempt <= REMOTE_RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      try {
        await waitForRetry(REMOTE_RETRY_DELAYS_MS[attempt - 1], requestSignal);
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
        break;
      }
    }
    try {
      const response = await fetch(`${env.docxPdfConverterUrl}/convert/docx-to-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "x-converter-secret": env.converterSecret,
        },
        body: new Uint8Array(docx),
        signal: requestSignal,
      });
      if (!response.ok) {
        const detail = responseDetail(await response.text().catch(() => ""));
        const error = new PdfConversionError(
          `PDF 转换服务返回异常（HTTP ${response.status}${detail ? `：${detail}` : ""}）`,
          response.status,
        );
        lastError = error;
        if ([502, 503, 504].includes(response.status) && attempt < REMOTE_RETRY_DELAYS_MS.length) {
          if (response.status === 503) await ensureRemoteConverterReady(requestSignal);
          continue;
        }
        throw error;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      assertPdf(buffer);
      const headerPageCount = Number(response.headers.get("x-pdf-page-count"));
      return { buffer, pageCount: Number.isFinite(headerPageCount) && headerPageCount > 0 ? headerPageCount : inferredPageCount(buffer) };
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (timeoutSignal.aborted) {
        break;
      }
      if (attempt < REMOTE_RETRY_DELAYS_MS.length && !(error instanceof PdfConversionError)) {
        continue;
      }
      break;
    }
  }
  if (timeoutSignal.aborted) {
    throw new PdfConversionError("PDF 转换服务连接失败或冷启动超时，请稍后重试");
  }
  if (lastError instanceof PdfConversionError) throw lastError;
  throw new PdfConversionError("PDF 转换服务连接失败或冷启动超时，请稍后重试");
}

export async function convertDocxToPdf(
  docx: Buffer,
  sourceText: string,
  _requestUrl: string,
  signal?: AbortSignal,
): Promise<PdfRenderResult> {
  const converted = process.env.VERCEL === "1"
    ? await (async () => {
      await ensureRemoteConverterReady(signal);
      return remoteDocxToPdf(docx, signal);
    })()
    : { buffer: await localDocxToPdf(docx, signal), pageCount: 0 };
  return {
    buffer: converted.buffer,
    pageCount: converted.pageCount || inferredPageCount(converted.buffer),
    sourceLineCount: Math.max(1, sourceText.split(/\r?\n/).length),
    textLength: sourceText.length,
  };
}
