import { DocumentConversionError } from "./converter";
import { getServerEnv } from "./config";
import { renderMarkdownPdf, type PdfRenderResult } from "./pdf-generator";

const PDF_RENDER_TIMEOUT_MS = 240_000;

function sourceLineCount(markdown: string): number {
  return markdown.replace(/\r\n/g, "\n").split("\n").length;
}

export async function renderPdfDocument(
  markdown: string,
  softwareName: string,
  version: string,
  kind: "code" | "manual" | "summary",
  requestUrl: string,
  signal?: AbortSignal,
): Promise<PdfRenderResult> {
  if (process.env.VERCEL !== "1") {
    return renderMarkdownPdf(markdown, softwareName, version, kind, signal);
  }

  const endpoint = new URL("/api/pdf", requestUrl).toString();
  const timeoutSignal = AbortSignal.timeout(PDF_RENDER_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pdf-secret": getServerEnv().converterSecret,
      },
      body: JSON.stringify({ kind, markdown, softwareName, version }),
      signal: requestSignal,
    });
    if (!response.ok) {
      throw new DocumentConversionError(`PDF 渲染服务返回异常（HTTP ${response.status}）`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const pageCount = Number(response.headers.get("x-pdf-page-count") || 0);
    if (!pageCount || !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new DocumentConversionError("PDF 渲染服务返回了无效文件");
    }
    return {
      buffer,
      pageCount,
      sourceLineCount: Number(response.headers.get("x-pdf-source-line-count") || sourceLineCount(markdown)),
      textLength: Number(response.headers.get("x-pdf-text-length") || markdown.length),
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeoutSignal.aborted) {
      throw new DocumentConversionError("PDF 渲染服务超时，请稍后重试");
    }
    if (error instanceof DocumentConversionError) throw error;
    throw new DocumentConversionError("PDF 渲染服务连接失败，请稍后重试");
  }
}
