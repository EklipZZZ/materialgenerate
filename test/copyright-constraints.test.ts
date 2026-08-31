import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationFields,
  copyrightHolderFields,
  enrichRequestSchema,
} from "../src/server/api-contracts.ts";
import {
  formToAiMarkdown,
  formToMarkdown,
  mergeEnrichment,
  parseEnrichedMarkdown,
} from "../src/server/form.ts";
import { validateCopyrightTextFields } from "../src/lib/copyright-constraints.ts";
import {
  parseChoiceSelection,
  serializeChoiceSelection,
  SOFTWARE_CATEGORY_OPTIONS,
} from "../src/lib/copyright-options.ts";

const mainFunctions = "功能描述".repeat(130);

test("choice fields preserve multiple presets and custom values", () => {
  const selection = parseChoiceSelection("应用软件、工业软件、自研平台", SOFTWARE_CATEGORY_OPTIONS);
  assert.deepEqual(selection.selected, ["应用软件", "工业软件"]);
  assert.equal(selection.custom, "自研平台");
  assert.equal(serializeChoiceSelection(selection.selected, selection.custom), "应用软件、工业软件、自研平台");
  assert.equal(serializeChoiceSelection(["应用软件", "应用软件"], "工业软件、工业软件"), "应用软件、工业软件");
});

test("registration field limits are enforced while an empty draft remains valid", () => {
  assert.equal(applicationFields.safeParse({ main_functions: "" }).success, true);
  assert.equal(applicationFields.safeParse({ main_functions: "字".repeat(499) }).success, true);
  assert.equal(applicationFields.safeParse({ main_functions: mainFunctions }).success, true);
  assert.equal(applicationFields.safeParse({ main_functions: "字".repeat(1301) }).success, false);
  assert.equal(applicationFields.safeParse({ development_hardware: "字".repeat(51) }).success, false);
  assert.equal(applicationFields.safeParse({ technical_features: "字".repeat(101) }).success, false);
  assert.equal(applicationFields.safeParse({ development_purpose: "字".repeat(50) }).success, true);
  assert.equal(validateCopyrightTextFields({ main_functions: "字".repeat(499) }, { requireMainFunctions: true }).length > 0, true);
  assert.equal(validateCopyrightTextFields({ main_functions: mainFunctions }, { requireMainFunctions: true }).length, 0);
});

test("organization holders do not accept the old date or park fields", () => {
  const base = {
    holder_type: "organization" as const,
    name: "示例企业",
    category: "企业法人",
    document_type: "营业执照",
    document_number: "91310000TEST00001",
    nationality: "中国",
    province: "上海市",
    city: "上海市",
  };
  assert.equal(copyrightHolderFields.safeParse({ ...base }).success, true);
  assert.equal(copyrightHolderFields.safeParse({ ...base, birth_or_established_date: "2020-01-01" }).success, false);
  assert.equal(copyrightHolderFields.safeParse({ ...base, park: "不应再采集" }).success, false);

  const markdown = formToMarkdown({
    copyright_holders: [{ ...base, birth_or_established_date: "2020-01-01", sort_order: 0 }],
  } as never);
  assert.equal(markdown.includes("成立日期"), false);
});

test("AI enrichment only fills approved empty technical fields", () => {
  const base = {
    contact_name: "用户填写的联系人",
    main_functions: "",
    development_purpose: "已有目的",
  };
  const candidate = {
    contact_name: "模型猜测的联系人",
    main_functions: "短内容",
    development_purpose: "模型覆盖的目的",
    technical_features: "安全、稳定、可扩展",
  };
  const mergedShort = mergeEnrichment(base, candidate);
  assert.equal(mergedShort.contact_name, "用户填写的联系人");
  assert.equal(mergedShort.development_purpose, "已有目的");
  assert.equal(mergedShort.main_functions, "");

  const mergedValid = mergeEnrichment(base, { ...candidate, main_functions: mainFunctions });
  assert.equal(mergedValid.main_functions, mainFunctions);
  assert.match(String(mergedValid.technical_features), /安全/);

  const existingMain = { ...base, main_functions: "历史上保存的短内容" };
  const preserved = mergeEnrichment(existingMain, { ...candidate, main_functions: mainFunctions });
  assert.equal(preserved.main_functions, "历史上保存的短内容");
  const replaced = mergeEnrichment(
    existingMain,
    { ...candidate, main_functions: mainFunctions },
    { replaceFields: ["main_functions"] },
  );
  assert.equal(replaced.main_functions, mainFunctions);

  const multiline = `第一段：${"功能描述".repeat(130)}\n第二段：补充操作流程。`;
  const parsed = parseEnrichedMarkdown(`| **软件的主要功能** | ${multiline} |`, {});
  assert.equal(parsed.main_functions, multiline);

  const enrichRequest = enrichRequestSchema.safeParse({
    applicationId: "00000000-0000-0000-0000-000000000000",
    llmConfigId: "11111111-1111-4111-8111-111111111111",
    regenerateMainFunctions: true,
    draft: { main_functions: "" },
  });
  assert.equal(enrichRequest.success, true);

  const aiMarkdown = formToAiMarkdown({ contact_name: "不应发送给模型", software_full_name: "示例软件" });
  assert.equal(aiMarkdown.includes("联系人"), false);
  assert.match(aiMarkdown, /示例软件/);
});
