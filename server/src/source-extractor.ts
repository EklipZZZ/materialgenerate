import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

const codeExtensions = [
  ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".py", ".java", ".c", ".cpp", ".h",
  ".hpp", ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala", ".html", ".css",
  ".scss", ".sass", ".less", ".json", ".yaml", ".yml", ".xml", ".sql", ".sh", ".bash",
  ".ps1", ".md", ".txt", ".ini", ".conf", ".cfg", ".env",
];
const ignoredDirectories = new Set([
  "node_modules", ".git", ".svn", ".hg", "dist", "build", "out", "target", "bin", "obj",
  "__pycache__", ".pytest_cache", ".venv", "venv", ".next", ".cache", "coverage", "vendor",
  "packages", ".idea", ".vscode",
]);
const ignoredFiles = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".DS_Store", "Thumbs.db"]);

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  throw error;
}

function run(command: string, args: string[], signal?: AbortSignal) {
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], signal });
    child.stderr.on("data", () => undefined);
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("source archive extraction failed"));
    });
  });
}

export async function extractSourceCode(
  buffer: Buffer,
  fileName: string,
  progress: (message: string) => void,
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  const root = await mkdtemp(join(tmpdir(), "softreg-source-"));
  const upload = join(root, basename(fileName));
  const extracted = join(root, "extracted");
  try {
    await writeFile(upload, buffer);
    await mkdir(extracted, { recursive: true });
    progress("正在解压源代码压缩包");
    if (fileName.toLowerCase().endsWith(".tar.gz") || fileName.toLowerCase().endsWith(".tgz")) {
      await run("tar", ["-xzf", upload, "-C", extracted], signal);
    } else if (fileName.toLowerCase().endsWith(".zip")) {
      await run("unzip", ["-q", upload, "-d", extracted], signal);
    } else {
      throw new Error("仅支持 ZIP、TAR.GZ 或 TGZ 源代码压缩包");
    }

    const paths: string[] = [];
    async function walk(directory: string) {
      throwIfAborted(signal);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!ignoredDirectories.has(entry.name) && !entry.name.startsWith(".")) await walk(full);
        } else if (entry.isFile() && !ignoredFiles.has(entry.name)) {
          const lower = entry.name.toLowerCase();
          if (codeExtensions.some((extension) => lower.endsWith(extension))) {
            paths.push(full);
            if (paths.length > 10_000) throw new Error("source archive contains too many files");
          }
        }
      }
    }
    await walk(extracted);
    progress("正在读取源代码文件，共 " + paths.length + " 个");
    const contents: string[] = [];
    const fileList: string[] = [];
    let totalBytes = 0;
    for (const path of paths) {
      throwIfAborted(signal);
      try {
        const content = await readFile(path, "utf8");
        if (content.length > 0 && content.length < 500 * 1024) {
          totalBytes += Buffer.byteLength(content, "utf8");
          if (totalBytes > 50 * 1024 * 1024) throw new Error("source archive content is too large");
          contents.push(content);
          fileList.push(relative(extracted, path).replaceAll("\\", "/"));
        }
      } catch (error) {
        if (error instanceof Error && error.message === "source archive content is too large") throw error;
        // Ignore unreadable files.
      }
    }
    const totalLines = contents.reduce((sum, item) => sum + item.split("\n").length, 0);
    return {
      content: contents.join("\n"),
      fileCount: contents.length,
      fileList,
      summary: "已读取 " + contents.length + " 个源代码文件，约 " + totalLines + " 行。",
    };
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}
