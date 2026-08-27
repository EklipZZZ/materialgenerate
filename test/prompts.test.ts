import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanCodeContent,
  cleanManualContent,
  manualModules,
  sourceModules,
} from "../src/server/generation-prompts.ts";

test("original modular generation structure is retained", () => {
  assert.equal(sourceModules.length, 7);
  assert.equal(manualModules.length, 5);
  assert.equal(sourceModules[0].name, "config");
  assert.equal(sourceModules.at(-1)?.name, "main");
  assert.equal(manualModules.at(-1)?.name, "tech_test");
});

test("markdown cleanup removes only the original formatting wrappers", () => {
  assert.equal(cleanCodeContent("```python\nprint(1)\n```"), "print(1)");
  assert.equal(cleanManualContent("```markdown\n# 标题\n\n\n---\n```"), "# 标题");
});
