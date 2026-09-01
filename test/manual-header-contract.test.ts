import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("manual converter replaces the legacy floating PAGE field with a source-style inline header", async () => {
  const converter = await readFile("assets/manual_convert.py", "utf8");

  assert.match(converter, /for child in list\(header_element\):[\s\S]*?header_element\.remove\(child\)/);
  assert.match(converter, /用户手册'\)/);
  assert.match(converter, /instrText\.text = "PAGE"/);
  assert.match(converter, /self\.add_header_with_page_number\(\)/);
  assert.doesNotMatch(converter, /if not self\.cover_template:[\s\S]*?self\.add_header_with_page_number\(\)/);
});
