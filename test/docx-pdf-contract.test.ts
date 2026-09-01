import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("formal generation converts each generated DOCX through LibreOffice service", async () => {
  const [pipeline, client, dockerfile] = await Promise.all([
    readFile("src/server/generation-pipeline.ts", "utf8"),
    readFile("src/server/pdf-client.ts", "utf8"),
    readFile("services/docx-pdf-converter/Dockerfile", "utf8"),
  ]);
  assert.equal(pipeline.includes("renderPdfDocument("), false);
  assert.equal((pipeline.match(/convertDocxToPdf\(/g) || []).length, 3);
  assert.match(client, /\/convert\/docx-to-pdf/);
  assert.match(client, /x-converter-secret/);
  assert.match(dockerfile, /libreoffice-writer/);
  assert.match(dockerfile, /fonts-noto-cjk/);
});
