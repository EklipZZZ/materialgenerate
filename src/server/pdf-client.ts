import { renderMarkdownPdf, type PdfRenderResult } from "./pdf-generator";

export async function renderPdfDocument(
  markdown: string,
  softwareName: string,
  version: string,
  kind: "code" | "manual" | "summary",
  _requestUrl: string,
  signal?: AbortSignal,
): Promise<PdfRenderResult> {
  // PDF generation is already a pure Node.js operation. Calling `/api/pdf`
  // from another Vercel function adds a second serverless request and can
  // leave the parent request waiting for a response body after the child has
  // logged HTTP 200. Render in-process for the main generation pipeline;
  // `/api/pdf` remains available as the authenticated standalone endpoint.
  return renderMarkdownPdf(markdown, softwareName, version, kind, signal);
}
