import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_COPYRIGHT_FORM,
  formToMarkdown,
  recordToFormData,
} from "../src/lib/copyright-form.ts";

test("legacy company fields become an organization copyright holder", () => {
  const form = recordToFormData({
    id: "00000000-0000-0000-0000-000000000001",
    company_name: "示例科技有限公司",
    credit_code: "91310000TESTCODE001",
    software_full_name: "示例软件",
  });
  assert.equal(form.copyright_holders.length, 1);
  assert.equal(form.copyright_holders[0].holder_type, "organization");
  assert.equal(form.copyright_holders[0].name, "示例科技有限公司");
  assert.equal(form.copyright_holders[0].document_number, "91310000TESTCODE001");
});

test("person and organization holders are preserved as a mixed application", () => {
  const form = recordToFormData({
    ...EMPTY_COPYRIGHT_FORM,
    copyright_holders: [
      {
        holder_type: "person",
        name: "张三",
        category: "自然人",
        document_type: "居民身份证",
        document_number: "110101199001010011",
        nationality: "中国",
        province: "北京市",
        city: "北京市",
        sort_order: 0,
      },
      {
        holder_type: "organization",
        name: "示例企业",
        category: "企业法人",
        document_type: "统一社会信用代码证书",
        document_number: "91310000MIXED00001",
        nationality: "中国",
        province: "上海市",
        city: "上海市",
        sort_order: 1,
      },
    ],
  });
  assert.deepEqual(form.copyright_holders.map((holder) => holder.holder_type), ["person", "organization"]);
  const markdown = formToMarkdown(form);
  assert.match(markdown, /张三/);
  assert.match(markdown, /110101199001010011/);
  assert.match(markdown, /91310000MIXED00001/);
});
