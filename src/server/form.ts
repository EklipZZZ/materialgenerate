import { characterCount, validateCopyrightTextFields } from "../lib/copyright-constraints.ts";

export const formFields = [
  "software_full_name",
  "software_short_name",
  "version",
  "software_category",
  "work_type",
  "development_date",
  "is_published",
  "first_publication_date",
  "first_publication_country",
  "first_publication_city",
  "development_method",
  "rights_acquisition_method",
  "rights_scope",
  "rights_scope_description",
  "original_registration_number",
  "modification_description",
  "application_method",
  "applicant_address",
  "postal_code",
  "contact_name",
  "contact_phone",
  "contact_email",
  "development_hardware",
  "runtime_hardware",
  "development_os",
  "development_tools",
  "runtime_platform",
  "runtime_environment",
  "programming_language",
  "source_code_lines",
  "development_purpose",
  "target_industry",
  "main_functions",
  "technical_features",
  "company_name",
  "credit_code",
] as const;

/** 只把技术性申请字段交给模型；身份、权利、申请人和联系方式不参与自动补全。 */
export const aiEnrichmentFields = [
  "software_short_name",
  "software_category",
  "development_hardware",
  "runtime_hardware",
  "development_os",
  "development_tools",
  "runtime_platform",
  "runtime_environment",
  "programming_language",
  "development_purpose",
  "target_industry",
  "main_functions",
  "technical_features",
] as const;

const aiContextFields = [
  "software_full_name",
  "version",
  ...aiEnrichmentFields,
] as const;

const labels: Record<string, string> = {
  software_full_name: "软件全称",
  software_short_name: "软件简称",
  version: "版本号",
  software_category: "软件分类",
  work_type: "软件作品说明",
  development_date: "开发完成日期",
  is_published: "是否发表",
  first_publication_date: "首次发表日期",
  first_publication_country: "首次发表国家",
  first_publication_city: "首次发表城市",
  development_method: "开发方式",
  rights_acquisition_method: "权利取得方式",
  rights_scope: "权利范围",
  rights_scope_description: "权利范围说明",
  original_registration_number: "原登记号",
  modification_description: "修改说明",
  application_method: "申请办理方式",
  applicant_address: "申请人地址",
  postal_code: "邮政编码",
  contact_name: "联系人",
  contact_phone: "联系电话",
  contact_email: "联系邮箱",
  development_hardware: "开发的硬件环境",
  runtime_hardware: "运行的硬件环境",
  development_os: "开发操作系统",
  development_tools: "软件开发环境工具",
  runtime_platform: "运行平台操作系统",
  runtime_environment: "软件运行支撑环境",
  programming_language: "编程语言",
  source_code_lines: "源码代码行数",
  development_purpose: "开发目的",
  target_industry: "面向领域/行业",
  main_functions: "软件的主要功能",
  technical_features: "软件技术特点",
  company_name: "兼容旧字段：公司名称",
  credit_code: "兼容旧字段：统一社会信用代码",
};

const displayLabels: Record<string, string> = {
  original: "原创",
  modified: "修改",
  independent: "单独开发",
  cooperative: "合作开发",
  commissioned: "委托开发",
  assigned_task: "下达任务开发",
  transfer: "受让",
  inheritance: "继承",
  assumption: "承受",
  all: "全部权利",
  partial: "部分权利",
  copyright_holder: "著作权人申请办理",
  agent: "代理人申请办理",
};

function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (key === "is_published") return value === true ? "已发表" : "未发表";
  return displayLabels[String(value)] || String(value);
}

function holderSummary(row: Record<string, unknown>): string {
  const holders = Array.isArray(row.copyright_holders) ? row.copyright_holders : [];
  const summary = holders
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
    .map((holder) => `${String(holder.name || "")}（${holder.holder_type === "person" ? "自然人" : "单位"}）`)
    .filter((value) => !value.startsWith("（"))
    .join("；");
  return summary || String(row.company_name || "");
}

function holderDetails(row: Record<string, unknown>): string {
  const holders = Array.isArray(row.copyright_holders) ? row.copyright_holders : [];
  return holders
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
    .map((holder) => {
      const type = holder.holder_type === "person" ? "自然人" : "单位";
      const location = [holder.nationality, holder.province, holder.city].filter(Boolean).join("/");
      const date = holder.holder_type === "person" && holder.birth_or_established_date
        ? `，出生日期：${String(holder.birth_or_established_date)}`
        : "";
      return `${String(holder.name || "")}（${type}；${String(holder.category || "")}；${String(holder.document_type || "")}：${String(holder.document_number || "")}；${location || "未填写地区"}${date}）`;
    })
    .filter((value) => !value.startsWith("（"))
    .join("；");
}

export function snapshotFields(row: Record<string, unknown>) {
  return Object.fromEntries(
    formFields
      .filter((key) => row[key] !== undefined)
      .map((key) => [key, row[key]]),
  );
}

export function formToMarkdown(row: Record<string, unknown>): string {
  const effective = row.enriched_data && typeof row.enriched_data === "object"
    ? { ...row, ...(row.enriched_data as Record<string, unknown>) }
    : row;
  const lines = [
    "### 计算机软件著作权登记信息采集表",
    "",
    "| 字段名称 | 填写内容 |",
    "| :--- | :--- |",
  ];
  for (const key of formFields) {
    const rawValue = key === "company_name" && !String(effective.company_name || "").trim()
      ? holderSummary(effective)
      : effective[key];
    const value = displayValue(key, rawValue).replace(/\|/g, "\\|");
    lines.push("| **" + labels[key] + "** | " + value + " |");
  }
  if (Array.isArray(effective.copyright_holders) && effective.copyright_holders.length) {
    const details = holderDetails(effective).replace(/\|/g, "\\|");
    if (details) lines.push("| **著作权人明细** | " + details + " |");
  }
  return lines.join("\n");
}

export function formToAiMarkdown(row: Record<string, unknown>): string {
  const effective = row.enriched_data && typeof row.enriched_data === "object"
    ? { ...row, ...(row.enriched_data as Record<string, unknown>) }
    : row;
  const lines = [
    "### 软件著作权技术信息（仅供 AI 补全）",
    "",
    "| 字段名称 | 填写内容 |",
    "| :--- | :--- |",
  ];
  for (const key of aiContextFields) {
    const rawValue = effective[key];
    const value = displayValue(key, rawValue).replace(/\|/g, "\\|");
    lines.push("| **" + labels[key] + "** | " + value + " |");
  }
  return lines.join("\n");
}

export function parseEnrichedMarkdown(markdown: string, base: Record<string, unknown>) {
  const result = { ...base };
  const labelToKey = Object.fromEntries([
    ...Object.entries(labels),
    ["开发硬件环境", "development_hardware"],
    ["运行硬件环境", "runtime_hardware"],
    ["开发工具", "development_tools"],
    ["运行平台", "runtime_platform"],
    ["运行环境", "runtime_environment"],
    ["源程序量", "source_code_lines"],
    ["主要功能", "main_functions"],
    ["技术特点", "technical_features"],
  ].map(([key, label]) => [label, key]));
  const rowRegex = /\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const key = labelToKey[match[1].trim()];
    if (!key || !match[2].trim()) continue;
    if (key === "is_published") result[key] = match[2].trim() === "已发表";
    else if (key === "source_code_lines") result[key] = Number.parseInt(match[2], 10) || 0;
    else if (["work_type", "development_method", "rights_acquisition_method", "rights_scope", "application_method"].includes(key)) {
      const label = match[2].trim();
      const entry = Object.entries(displayLabels).find(([, value]) => value === label);
      if (entry) result[key] = entry[0];
    } else result[key] = match[2].trim();
  }
  return result;
}

function isUsableAiValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return Boolean(normalized) && !["未填写", "未提供", "暂无", "未知", "无"].includes(normalized);
}

export function mergeEnrichment(base: Record<string, unknown>, candidate: Record<string, unknown>) {
  const result = { ...base };
  for (const field of aiEnrichmentFields) {
    const current = base[field];
    const proposed = candidate[field];
    if (isUsableAiValue(current) || !isUsableAiValue(proposed)) continue;
    if (field === "software_short_name" && characterCount(proposed.trim()) > 300) continue;
    if (validateCopyrightTextFields({ [field]: proposed }).length > 0) continue;
    result[field] = proposed.trim();
  }
  return result;
}
