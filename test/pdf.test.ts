import assert from "node:assert/strict";
import test from "node:test";
import { preflightPdf, renderMarkdownPdf } from "../src/server/pdf-generator.ts";

test("native PDF renderer embeds readable Chinese content and paginates", async () => {
  const markdown = [
    "# 软著材料测试",
    "",
    "软件名称：材料生成系统，版本号：V1.0。",
    "",
    "```python",
    ...Array.from({ length: 80 }, (_, index) => `print('第 ${index + 1} 行')`),
    "```",
  ].join("\n");
  const result = await renderMarkdownPdf(markdown, "材料生成系统", "V1.0", "code");
  assert.equal(result.buffer.subarray(0, 5).toString(), "%PDF-");
  assert.equal(result.buffer.includes(Buffer.from("%%EOF")), true);
  assert.ok(result.pageCount >= 1);
  assert.ok(result.buffer.length > 1_000);
  assert.deepEqual(preflightPdf(result, "材料生成系统", "V1.0", markdown, "code"), []);
});

test("native PDF renderer handles an unusually long source line", async () => {
  const markdown = [
    "x".repeat(100_000),
    ...Array.from({ length: 100 }, (_, index) => `const line${index} = ${index};`),
  ].join("\n");
  const result = await renderMarkdownPdf(markdown, "长行测试", "V1.0", "code");
  assert.equal(result.sourceLineCount, 101);
  assert.ok(result.pageCount > 1);
  assert.ok(result.buffer.includes(Buffer.from("%%EOF")));
});

test("native PDF renderer paginates a long mixed-language source archive", async () => {
  const markdown = Array.from(
    { length: 1_200 },
    (_, index) => `def detect_${index}():  # 图像检测结果与阈值分析\n    return ${index}`,
  ).join("\n");
  const result = await renderMarkdownPdf(markdown, "混合源码测试", "V1.0", "code");
  assert.equal(result.sourceLineCount, 2_400);
  assert.ok(result.pageCount > 20);
  assert.ok(result.buffer.includes(Buffer.from("%%EOF")));
});
