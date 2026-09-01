import assert from "node:assert/strict";
import test from "node:test";
import { generationObjectKeys } from "../src/server/generation-output.ts";

test("generated Storage object keys remain ASCII even for Chinese software display names", () => {
  const prefix = "generations/user/application/run-id";
  const keys = generationObjectKeys(prefix);
  assert.deepEqual(Object.values(keys), [
    `${prefix}/source-code.docx`,
    `${prefix}/source-code.pdf`,
    `${prefix}/user-manual.docx`,
    `${prefix}/user-manual.pdf`,
    `${prefix}/application-summary.pdf`,
    `${prefix}/collection-form.md`,
  ]);
  for (const key of Object.values(keys)) assert.match(key, /^[\x20-\x7e]+$/);
});
