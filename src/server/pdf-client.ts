import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getServerEnv } from "./config";
import type { PdfRenderResult } from "./pdf-generator";

const PDF_CONVERSION_TIMEOUT_MS = 150_000;
const MAX_PDF_BYTES = 30 * 1024 * 1024;

export class PdfConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfConversionError";
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(PDF_CONVERSION_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
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
        if ([502, 503, 504].includes(response.status) && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          continue;
        }
        throw new PdfConversionError(`PDF 转换服务返回异常（HTTP ${response.status}）`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      assertPdf(buffer);
      const headerPageCount = Number(response.headers.get("x-pdf-page-count"));
      return { buffer, pageCount: Number.isFinite(headerPageCount) && headerPageCount > 0 ? headerPageCount : inferredPageCount(buffer) };
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt === 0 && !(error instanceof PdfConversionError)) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        continue;
      }
      break;
    }
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
    ? await remoteDocxToPdf(docx, signal)
    : { buffer: await localDocxToPdf(docx, signal), pageCount: 0 };
  return {
    buffer: converted.buffer,
    pageCount: converted.pageCount || inferredPageCount(converted.buffer),
    sourceLineCount: Math.max(1, sourceText.split(/\r?\n/).length),
    textLength: sourceText.length,
  };
}
