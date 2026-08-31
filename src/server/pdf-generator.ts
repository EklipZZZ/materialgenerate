import PDFDocument from "pdfkit";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const A4_WIDTH = 595.28;
const MARGIN = 56;
const HEADER_Y = 28;
const FOOTER_Y = 806;
const CODE_ASCII_CHUNK_CHARS = 94;
const CODE_CJK_CHUNK_CHARS = 58;
const BODY_CHUNK_CHARS = 240;

type PdfRowKind = "body" | "heading" | "code" | "blank";

interface PdfRow {
  text: string;
  kind: PdfRowKind;
}

interface PdfCodeBlock {
  font: "ascii" | "chinese";
  lines: string[];
}

let cachedChineseFontPath: string | undefined;

function chineseFontPath(): string {
  if (cachedChineseFontPath) return cachedChineseFontPath;
  const fontFile = "noto-sans-sc-chinese-simplified-400-normal.woff";
  const fontPath = path.join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans-sc",
    "files",
    fontFile,
  );
  const candidates = [fontPath];
  const pnpmRoot = path.join(process.cwd(), "node_modules", ".pnpm");
  if (existsSync(pnpmRoot)) {
    for (const entry of readdirSync(pnpmRoot)) {
      if (!entry.startsWith("@fontsource+noto-sans-sc@")) continue;
      candidates.push(path.join(pnpmRoot, entry, "node_modules", "@fontsource", "noto-sans-sc", "files", fontFile));
    }
  }
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("中文字体资源未找到，请检查部署包中的 Noto Sans SC 字体");
  cachedChineseFontPath = found;
  return found;
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(```|`)/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

function splitForPdf(value: string, maxChars: number): string[] {
  if (value.length <= maxChars) return [value];
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + maxChars, value.length);
    // Avoid splitting a UTF-16 surrogate pair when a long line contains an
    // emoji or another supplementary Unicode character.
    if (end < value.length) {
      const codeUnit = value.charCodeAt(end);
      if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) end -= 1;
    }
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks.length ? chunks : [" "];
}

function addTextRows(rows: PdfRow[], text: string, kind: Exclude<PdfRowKind, "blank">): void {
  const maxChars = kind === "code" ? CODE_ASCII_CHUNK_CHARS : BODY_CHUNK_CHARS;
  for (const chunk of splitForPdf(text, maxChars)) {
    rows.push({ text: chunk || " ", kind });
  }
}

function markdownRows(markdown: string, forceCode = false): PdfRow[] {
  if (forceCode) {
    const rows: PdfRow[] = [];
    for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
      addTextRows(rows, line || " ", "code");
    }
    return rows;
  }
  const rows: PdfRow[] = [];
  let inCode = false;
  for (const originalLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = originalLine.replace(/\s+$/, "");
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      rows.push({ text: line || " ", kind: "code" });
      continue;
    }
    if (!line.trim()) {
      rows.push({ text: "", kind: "blank" });
      continue;
    }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+)$/);
    if (heading) {
      addTextRows(rows, cleanInlineMarkdown(heading[1]), "heading");
      continue;
    }
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)) continue;
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((cell) => cleanInlineMarkdown(cell));
      addTextRows(rows, cells.join("    "), "body");
      continue;
    }
    const listItem = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
    addTextRows(rows, listItem ? "• " + cleanInlineMarkdown(listItem[1]) : cleanInlineMarkdown(line), "body");
  }
  return rows;
}

function addPageChrome(document: PDFKit.PDFDocument, pageNumber: number, title: string): void {
  document.save();
  document.font(chineseFontPath()).fontSize(8).fillColor("#667085");
  document.text(`${title}`, MARGIN, HEADER_Y, { width: A4_WIDTH - MARGIN * 2, align: "left" });
  document.text(`第 ${pageNumber} 页`, MARGIN, FOOTER_Y, { width: A4_WIDTH - MARGIN * 2, align: "right" });
  document.restore();
  document.x = MARGIN;
  document.y = MARGIN + 14;
}

function codePdfBlocks(markdown: string): PdfCodeBlock[] {
  const blocks: PdfCodeBlock[] = [];
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const font = /[\u3400-\u9fff]/.test(line) ? "chinese" : "ascii";
    const maxChars = font === "chinese" ? CODE_CJK_CHUNK_CHARS : CODE_ASCII_CHUNK_CHARS;
    const chunks = splitForPdf(line || " ", maxChars);
    const last = blocks[blocks.length - 1];
    if (last?.font === font && last.lines.length + chunks.length <= 200) {
      last.lines.push(...chunks);
    } else {
      blocks.push({ font, lines: chunks });
    }
  }
  return blocks;
}

export interface PdfRenderResult {
  buffer: Buffer;
  pageCount: number;
  sourceLineCount: number;
  textLength: number;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("Operation aborted");
    error.name = "AbortError";
    throw error;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function renderMarkdownPdf(
  markdown: string,
  softwareName: string,
  version: string,
  kind: "code" | "manual" | "summary",
  signal?: AbortSignal,
): Promise<PdfRenderResult> {
  throwIfAborted(signal);
  const fontPath = chineseFontPath();
  if (!markdown.trim()) throw new Error("PDF 内容为空");
  const document = new PDFDocument({
    size: "A4",
    // Keep enough physical bottom margin for the footer. The renderer also
    // leaves a little more space before adding a new page through PDFKit.
    margins: { top: MARGIN + 14, bottom: 20, left: MARGIN, right: MARGIN },
    autoFirstPage: true,
    info: {
      Title: `${softwareName}-${kind}`,
      Author: "软著材料生成系统",
      Subject: "计算机软件著作权登记材料",
    },
  });
  const chunks: Buffer[] = [];
  let pageCount = 1;
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  document.on("pageAdded", () => {
    pageCount += 1;
    addPageChrome(document, pageCount, `${softwareName} · ${version}`);
  });
  addPageChrome(document, pageCount, `${softwareName} · ${version}`);

  document.font(fontPath).fillColor("#101828");
  document.fontSize(16).text(kind === "code" ? "源代码文档" : kind === "manual" ? "用户手册" : "申请信息摘要", {
    align: "center",
    width: A4_WIDTH - MARGIN * 2,
  });
  document.moveDown(0.8);

  const sourceLineCount = markdown.replace(/\r\n/g, "\n").split("\n").length;
  if (kind === "code") {
    // Keep ordinary source text on the fast built-in Courier font. Only lines
    // that actually contain Chinese use the embedded font; selecting the CJK
    // font for a whole mixed-language archive makes PDFKit's font shaping
    // needlessly slow and can exceed Vercel's function limit.
    const blocks = codePdfBlocks(markdown);
    for (const block of blocks) {
      throwIfAborted(signal);
      document.font(block.font === "chinese" ? fontPath : "Courier").fontSize(8.2).fillColor("#344054");
      document.text(block.lines.join("\n"), {
        lineGap: 1,
        width: A4_WIDTH - MARGIN * 2,
      });
      await yieldToEventLoop();
    }
  } else {
    const rows = markdownRows(markdown);
    for (const [index, row] of rows.entries()) {
      if (index % 100 === 0) {
        throwIfAborted(signal);
        await yieldToEventLoop();
      }
      if (document.y > 770) document.addPage();
      if (row.kind === "blank") {
        document.moveDown(0.35);
        continue;
      }
      if (row.kind === "heading") {
        document.font(fontPath).fontSize(12).fillColor("#1d2939").text(row.text, { continued: false });
        document.moveDown(0.25);
        continue;
      }
      document.font(fontPath).fontSize(10.2).fillColor("#101828").text(row.text, {
        lineGap: 3,
        width: A4_WIDTH - MARGIN * 2,
      });
      document.moveDown(0.2);
    }
  }
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    document.on("end", () => {
      const buffer = Buffer.concat(chunks);
      if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")) || !buffer.includes(Buffer.from("%%EOF"))) {
        reject(new Error("PDF 生成结果无效"));
        return;
      }
      resolve({
        buffer,
        pageCount,
        sourceLineCount,
        textLength: markdown.length,
      });
    });
    document.on("error", reject);
    document.end();
  });
}

export function preflightPdf(
  result: PdfRenderResult,
  softwareName: string,
  version: string,
  sourceText: string,
  kind: "code" | "manual" | "summary",
): string[] {
  const warnings: string[] = [];
  if (result.buffer.length < 1_000) warnings.push("PDF 文件体积异常，请检查字体资源");
  if (result.pageCount < 1) warnings.push("PDF 页数异常");
  if (result.sourceLineCount < 1) warnings.push("PDF 内容为空");
  if (!softwareName.trim() || !version.trim()) warnings.push("软件名称或版本号为空");
  if (kind === "code" && result.sourceLineCount < 60) {
    warnings.push("源代码行数较少，请按官方要求核对代码页数和每页行数");
  }
  if (kind === "code" && result.pageCount > 60) {
    warnings.push("源代码 PDF 超过 60 页，请按官方要求核对提交范围");
  }
  if (kind === "manual" && result.sourceLineCount < 10) {
    warnings.push("用户手册内容较少，请核对功能说明和操作步骤是否完整");
  }
  if (sourceText.trim() && result.textLength < Math.max(20, Math.floor(sourceText.length * 0.5))) {
    warnings.push("PDF 文本长度与源内容差异较大");
  }
  return warnings;
}
