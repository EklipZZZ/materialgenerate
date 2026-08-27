import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getServerEnv } from "./config";

type ConversionKind = "code" | "manual";

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
    await runPython(kind === "code" ? "code_convert.py" : "manual_convert.py", args, signal);
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
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-converter-secret": getServerEnv().converterSecret,
    },
    body: JSON.stringify({ kind, markdown, softwareName, version }),
    signal,
  });
  if (!response.ok) throw new Error("DOCX conversion failed");
  return Buffer.from(await response.arrayBuffer());
}
