/** Application fields shared by the Pages UI and the generation service. */
export interface CopyrightFormData {
  id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  software_full_name: string;
  software_short_name: string;
  version: string;
  software_category: string;
  development_date: string;
  is_published: boolean;
  development_hardware: string;
  runtime_hardware: string;
  development_os: string;
  development_tools: string;
  runtime_platform: string;
  runtime_environment: string;
  programming_language: string;
  source_code_lines: number;
  development_purpose: string;
  target_industry: string;
  main_functions: string;
  technical_features: string;
  company_name: string;
  credit_code: string;
}

export const EMPTY_COPYRIGHT_FORM: CopyrightFormData = {
  software_full_name: "",
  software_short_name: "",
  version: "V1.0",
  software_category: "",
  development_date: "",
  is_published: false,
  development_hardware: "PC",
  runtime_hardware: "PC",
  development_os: "Windows 10",
  development_tools: "",
  runtime_platform: "Windows 10",
  runtime_environment: "",
  programming_language: "",
  source_code_lines: 0,
  development_purpose: "",
  target_industry: "",
  main_functions: "",
  technical_features: "",
  company_name: "",
  credit_code: "",
};

const MD_FIELD_ROWS: Array<{ key: keyof CopyrightFormData; label: string }> = [
  { key: "software_full_name", label: "软件全称" },
  { key: "software_short_name", label: "软件简称" },
  { key: "version", label: "版本号" },
  { key: "software_category", label: "软件分类" },
  { key: "development_date", label: "开发完成日期" },
  { key: "is_published", label: "是否发表" },
  { key: "development_hardware", label: "开发硬件环境" },
  { key: "runtime_hardware", label: "运行硬件环境" },
  { key: "development_os", label: "开发操作系统" },
  { key: "development_tools", label: "开发工具" },
  { key: "runtime_platform", label: "运行平台" },
  { key: "runtime_environment", label: "运行环境" },
  { key: "programming_language", label: "编程语言" },
  { key: "source_code_lines", label: "源程序量" },
  { key: "development_purpose", label: "开发目的" },
  { key: "target_industry", label: "面向领域/行业" },
  { key: "main_functions", label: "主要功能" },
  { key: "technical_features", label: "技术特点" },
  { key: "company_name", label: "公司名称" },
  { key: "credit_code", label: "统一社会信用代码" },
];

const LABEL_TO_KEY = Object.fromEntries(
  MD_FIELD_ROWS.map(({ key, label }) => [label, key]),
) as Record<string, keyof CopyrightFormData>;

function formatFieldValue(key: keyof CopyrightFormData, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (key === "is_published") return value === true ? "已发表" : "未发表";
  return String(value);
}

export function formToMarkdown(form: CopyrightFormData): string {
  const lines = [
    "### 计算机软件著作权登记信息采集表",
    "",
    "| 字段名称 | 填写内容 |",
    "| :--- | :--- |",
  ];
  for (const { key, label } of MD_FIELD_ROWS) {
    const value = formatFieldValue(key, form[key]).replace(/\|/g, "\\|");
    lines.push("| **" + label + "** | " + value + " |");
  }
  return lines.join("\n");
}

export function recordToFormData(record: Record<string, unknown>): CopyrightFormData {
  const enriched = record.enriched_data as Record<string, unknown> | null;
  const base = enriched && record.status === "enriched" ? { ...record, ...enriched } : record;
  return {
    id: String(base.id ?? ""),
    status: String(base.status ?? "draft"),
    created_at: String(base.created_at ?? ""),
    updated_at: String(base.updated_at ?? ""),
    software_full_name: String(base.software_full_name ?? ""),
    software_short_name: String(base.software_short_name ?? ""),
    version: String(base.version ?? "V1.0"),
    software_category: String(base.software_category ?? ""),
    development_date: String(base.development_date ?? ""),
    is_published: base.is_published === true || base.is_published === "true" || base.is_published === "已发表",
    development_hardware: String(base.development_hardware ?? "PC"),
    runtime_hardware: String(base.runtime_hardware ?? "PC"),
    development_os: String(base.development_os ?? "Windows 10"),
    development_tools: String(base.development_tools ?? ""),
    runtime_platform: String(base.runtime_platform ?? "Windows 10"),
    runtime_environment: String(base.runtime_environment ?? ""),
    programming_language: String(base.programming_language ?? ""),
    source_code_lines: Number(base.source_code_lines ?? 0),
    development_purpose: String(base.development_purpose ?? ""),
    target_industry: String(base.target_industry ?? ""),
    main_functions: String(base.main_functions ?? ""),
    technical_features: String(base.technical_features ?? ""),
    company_name: String(base.company_name ?? ""),
    credit_code: String(base.credit_code ?? ""),
  };
}

export function parseMarkdownToForm(markdown: string, base: CopyrightFormData): CopyrightFormData {
  const result = { ...base };
  const rowRegex = /\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const key = LABEL_TO_KEY[match[1].trim()];
    const value = match[2].trim();
    if (!key || !value) continue;
    if (key === "is_published") result.is_published = value === "已发表";
    else if (key === "source_code_lines") result.source_code_lines = Number.parseInt(value, 10) || 0;
    else (result as Record<string, string | number | boolean>)[key] = value;
  }
  return result;
}

export function formToUpdatePayload(form: CopyrightFormData) {
  const { id, status, created_at, updated_at, ...rest } = form;
  void id;
  void status;
  void created_at;
  void updated_at;
  return rest;
}
