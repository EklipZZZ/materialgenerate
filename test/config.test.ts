import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHttpUrl } from "../src/server/config.ts";

test("converter URL accepts a bare SnapDeploy hostname", () => {
  assert.equal(
    normalizeHttpUrl("DOCX_PDF_CONVERTER_URL", "softreg-docx-pdf-fae4c.containers.snapdeploy.app"),
    "https://softreg-docx-pdf-fae4c.containers.snapdeploy.app",
  );
});

test("converter URL preserves valid HTTPS URLs and rejects malformed values", () => {
  assert.equal(
    normalizeHttpUrl("DOCX_PDF_CONVERTER_URL", "https://converter.example.com/"),
    "https://converter.example.com",
  );
  assert.throws(
    () => normalizeHttpUrl("DOCX_PDF_CONVERTER_URL", "[converter](https://converter.example.com)"),
    /Invalid server configuration URL/,
  );
});
