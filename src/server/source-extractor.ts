import { Gunzip, unzipSync } from "fflate";
import { extract as createTarExtractor } from "tar-stream";
import { posix } from "node:path";

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
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_CONTENT_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10_000;
const MAX_SOURCE_FILE_BYTES = 500 * 1024;

interface ArchiveFile {
  name: string;
  content: Buffer;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("Operation aborted");
    error.name = "AbortError";
    throw error;
  }
}

function safeArchivePath(name: string): string | null {
  const normalized = posix.normalize(name.replaceAll("\\", "/")).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.startsWith("/") || normalized.includes("/../")) return null;
  return normalized;
}

function isIgnoredFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ignoredFiles.has(name) || lower.endsWith(".min.js") || lower.endsWith(".min.css") || lower.endsWith(".bundle.js");
}

function parseTar(buffer: Buffer): Promise<ArchiveFile[]> {
  return new Promise((resolve, reject) => {
    const files: ArchiveFile[] = [];
    const extractor = createTarExtractor();
    let totalBytes = 0;
    let fileCount = 0;
    let failed = false;
    extractor.on("entry", (header, stream, next) => {
      const name = safeArchivePath(header.name);
      if (!name) {
        failed = true;
        stream.resume();
        reject(new Error("source archive contains an unsafe path"));
        return;
      }
      if (header.type === "symlink" || header.type === "link") {
        failed = true;
        stream.resume();
        reject(new Error("source archive contains a symbolic link"));
        return;
      }
      if (header.type === "file") {
        fileCount += 1;
        if (fileCount > MAX_FILES) {
          failed = true;
          stream.resume();
          reject(new Error("source archive contains too many files"));
          return;
        }
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let keepContent = true;
      stream.on("data", (chunk: unknown) => {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        size += data.length;
        totalBytes += data.length;
        if (totalBytes > MAX_CONTENT_BYTES) {
          failed = true;
          stream.destroy(new Error("source archive content is too large"));
          return;
        }
        if (size <= MAX_SOURCE_FILE_BYTES) chunks.push(data);
        else keepContent = false;
      });
      stream.on("error", (error) => {
        if (!failed) {
          failed = true;
          reject(error);
        }
      });
      stream.on("end", () => {
        if (!failed && keepContent && header.type === "file") files.push({ name, content: Buffer.concat(chunks) });
        if (!failed) next();
      });
    });
    extractor.on("finish", () => {
      if (!failed) resolve(files);
    });
    extractor.on("error", (error) => {
      if (!failed) {
        failed = true;
        reject(error);
      }
    });
    extractor.end(buffer);
  });
}

function gunzipLimited(buffer: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let failure: Error | null = null;
  const gunzip = new Gunzip((data) => {
    if (failure) return;
    totalBytes += data.length;
    if (totalBytes > MAX_CONTENT_BYTES) {
      failure = new Error("source archive content is too large");
      return;
    }
    chunks.push(Buffer.from(data));
  });
  try {
    gunzip.push(buffer, true);
  } catch {
    failure = new Error("source archive gzip stream is invalid");
  }
  if (failure) throw failure;
  return Buffer.concat(chunks);
}

function readZip(buffer: Buffer): ArchiveFile[] {
  let fileCount = 0;
  let totalBytes = 0;
  const entries = unzipSync(buffer, {
    filter(file) {
      if (!safeArchivePath(file.name)) throw new Error("source archive contains an unsafe path");
      fileCount += 1;
      if (fileCount > MAX_FILES) return false;
      if (file.originalSize > MAX_SOURCE_FILE_BYTES) return false;
      if (totalBytes + file.originalSize > MAX_CONTENT_BYTES) return false;
      totalBytes += file.originalSize;
      return true;
    },
  });
  return Object.entries(entries).map(([name, content]) => ({ name, content: Buffer.from(content) }));
}

async function readArchive(buffer: Buffer, fileName: string): Promise<ArchiveFile[]> {
  if (buffer.length > MAX_ARCHIVE_BYTES) throw new Error("source archive is too large");
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".zip")) {
    return readZip(buffer);
  }
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    return parseTar(gunzipLimited(buffer));
  }
  throw new Error("仅支持 ZIP、TAR.GZ 或 TGZ 源代码压缩包");
}

export async function extractSourceCode(
  buffer: Buffer,
  fileName: string,
  progress: (message: string) => void,
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  progress("正在解压源代码压缩包");
  const archive = await readArchive(buffer, fileName);
  const contents: string[] = [];
  const fileList: string[] = [];
  let totalBytes = 0;
  for (const entry of archive) {
    throwIfAborted(signal);
    const pathParts = entry.name.split("/");
    if (pathParts.some((part) => ignoredDirectories.has(part) || part.startsWith("."))) continue;
    if (isIgnoredFile(pathParts[pathParts.length - 1])) continue;
    const lower = entry.name.toLowerCase();
    if (!codeExtensions.some((extension) => lower.endsWith(extension))) continue;
    if (entry.content.length === 0 || entry.content.length >= MAX_SOURCE_FILE_BYTES) continue;
    totalBytes += entry.content.length;
    if (totalBytes > MAX_CONTENT_BYTES) throw new Error("source archive content is too large");
    contents.push(entry.content.toString("utf8"));
    fileList.push(entry.name);
    if (contents.length > MAX_FILES) throw new Error("source archive contains too many files");
  }
  progress("正在读取源代码文件，共 " + contents.length + " 个");
  const totalLines = contents.reduce((sum, item) => sum + item.split("\n").length, 0);
  return {
    content: contents.join("\n"),
    fileCount: contents.length,
    fileList,
    summary: "已读取 " + contents.length + " 个源代码文件，约 " + totalLines + " 行。",
  };
}
