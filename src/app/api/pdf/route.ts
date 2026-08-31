import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { pdfRenderRequestSchema } from "@/server/api-contracts";
import { getServerEnv } from "@/server/config";
import { renderMarkdownPdf } from "@/server/pdf-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

function matchesSecret(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function POST(request: NextRequest) {
  try {
    const expected = getServerEnv().converterSecret;
    const supplied = request.headers.get("x-pdf-secret") || "";
    if (!matchesSecret(supplied, expected)) {
      return Response.json({ code: 401, msg: "Unauthorized", data: null }, { status: 401 });
    }
    const parsed = pdfRenderRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ code: 400, msg: "PDF 渲染参数无效", data: null }, { status: 400 });
    }
    const body = parsed.data;
    const result = await renderMarkdownPdf(body.markdown, body.softwareName, body.version, body.kind, request.signal);
    const responseBody = new Uint8Array(result.buffer.length);
    responseBody.set(result.buffer);
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(result.buffer.length),
        "Cache-Control": "no-store",
        "X-PDF-Page-Count": String(result.pageCount),
        "X-PDF-Source-Line-Count": String(result.sourceLineCount),
        "X-PDF-Text-Length": String(result.textLength),
      },
    });
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    console.error("[api/pdf] render failed", {
      name: normalized.name,
      message: normalized.message,
    });
    return Response.json({ code: 500, msg: "PDF 渲染失败", data: null }, { status: 500 });
  }
}
