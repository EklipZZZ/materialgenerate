import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getServerEnv } from "./config";

type ConversionKind = "code" | "manual" | "summary";
const DOCUMENT_CONVERSION_TIMEOUT_MS = 120_000;

export class DocumentConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentConversionError";
  }
}

function runPython(script: string, args: string[], signal?: AbortSignal): Promise<void> {
  const assetRoot = resolve(process.cwd(), "assets");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(getServerEnv().pythonBin, [join(assetRoot, script), ...args], {
      cwd: assetRoot,
      stdio: ["ignore", "ignore", "pipe"],
      signal,
    });
    child.stderr.on("data", () => undefined);
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolvePromise() : reject(new Error("DOCX conversion failed")));
  });
}

async function localConversion(
  kind: ConversionKind,
  markdown: string,
  softwareName: string,
  version: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "materialgenerate-convert-"));
  const inputPath = join(directory, "input.md");
  const outputPath = join(directory, "output.docx");
  try {
    await writeFile(inputPath, markdown, "utf8");
    const args = ["--input_md", inputPath, "--output_docx", outputPath, "--software_name", softwareName, "--version", version];
    if (kind === "manual") args.push("--cover", resolve(process.cwd(), "assets/template.docx"));
    const script = kind === "code" ? "code_convert.py" : kind === "manual" ? "manual_convert.py" : "summary_convert.py";
    await runPython(script, args, signal);
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function convertMarkdown(
  kind: ConversionKind,
  markdown: string,
  softwareName: string,
  version: string,
  requestUrl: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (process.env.VERCEL !== "1") {
    return localConversion(kind, markdown, softwareName, version, signal);
  }
  const endpoint = new URL("/api/convert", requestUrl).toString();
  const timeoutSignal = AbortSignal.timeout(DOCUMENT_CONVERSION_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-converter-secret": getServerEnv().converterSecret,
      },
      body: JSON.stringify({ kind, markdown, softwareName, version }),
      signal: requestSignal,
    });
    if (!response.ok) throw new DocumentConversionError(`DOCX 转换服务返回异常（HTTP ${response.status}）`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeoutSignal.aborted) {
      throw new DocumentConversionError("DOCX 转换服务超时，请检查转换服务后重试");
    }
    if (error instanceof DocumentConversionError) throw error;
    throw new DocumentConversionError("DOCX 转换服务连接失败，请稍后重试");
  }
}
