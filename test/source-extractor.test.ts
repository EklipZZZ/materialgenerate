import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync, strToU8, zipSync } from "fflate";
import { pack } from "tar-stream";
import { extractSourceCode } from "../src/server/source-extractor.ts";
import { generateSourceFeedback } from "../src/server/source-feedback.ts";

const progress = () => undefined;

async function makeTarGz(): Promise<Buffer> {
  const tar = await new Promise<Buffer>((resolve) => {
    const archive = pack();
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.entry({ name: "src/main.py", type: "file" }, Buffer.from("print(1)\n"), () => archive.finalize());
  });
  return Buffer.from(gzipSync(tar));
}

test("extracts ZIP and TAR.GZ source files without shell commands", async () => {
  const zip = Buffer.from(zipSync({ "src/main.py": strToU8("print(1)\n") }));
  const zipResult = await extractSourceCode(zip, "source.zip", progress);
  assert.match(zipResult.content, /print\(1\)/u);
  assert.equal(zipResult.lineCount, 2);

  const tarResult = await extractSourceCode(await makeTarGz(), "source.tar.gz", progress);
  assert.match(tarResult.content, /print\(1\)/u);
  assert.equal(tarResult.lineCount, 2);
});

test("rejects archive path traversal and TAR symbolic links", async () => {
  const traversal = Buffer.from(zipSync({ "../evil.py": strToU8("bad") }));
  await assert.rejects(() => extractSourceCode(traversal, "evil.zip", progress));

  const symlinkTar = await new Promise<Buffer>((resolve) => {
    const archive = pack();
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.entry({ name: "link.py", type: "symlink", linkname: "main.py" }, "", () => archive.finalize());
  });
  await assert.rejects(() => extractSourceCode(Buffer.from(gzipSync(symlinkTar)), "link.tgz", progress));
});

test("does not expand ZIP entries larger than one source file limit", async () => {
  const large = new Uint8Array(500 * 1024 + 1);
  large.fill(97);
  const archive = Buffer.from(zipSync({ "src/large.py": large }));
  const result = await extractSourceCode(archive, "large.zip", progress);
  assert.equal(result.fileCount, 0);
  assert.equal(result.content, "");
});

test("source feedback does not call the model when no source files are readable", async () => {
  const archive = Buffer.from(zipSync({ "assets/logo.png": strToU8("not source code") }));
  const result = await generateSourceFeedback({
    application: { contact_name: "private contact" },
    sourceBuffer: archive,
    sourceFileName: "assets.zip",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    apiKey: "not-used",
  });
  assert.equal(result.fileCount, 0);
  assert.equal(result.sourceCodeLines, 0);
  assert.deepEqual(result.suggestions, []);
});
