/** 软著采集表字段（与 Supabase / 小程序一致，snake_case） */
export interface CopyrightFormData {
  id?: string;
  user_id?: string;
  query_code?: string;
  status?: string;
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
  development_hardware: "PC机",
  runtime_hardware: "PC机",
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
  { key: "development_date", label: "软件开发完成日期" },
  { key: "is_published", label: "是否发表" },
  { key: "development_hardware", label: "开发的硬件环境(50字符内)" },
  { key: "runtime_hardware", label: "运行的硬件环境(50字符内)" },
  { key: "development_os", label: "开发操作系统(50字符内)" },
  { key: "development_tools", label: "软件开发环境/工具(50字符内)" },
  { key: "runtime_platform", label: "运行平台/操作系统(50字符内)" },
  { key: "runtime_environment", label: "软件运行支撑环境(50字符内)" },
  { key: "programming_language", label: "编程语言(50字符内)" },
  { key: "source_code_lines", label: "源程序量" },
  { key: "development_purpose", label: "开发目的(50字符内)" },
  { key: "target_industry", label: "面向领域 / 行业(50字符内)" },
  { key: "main_functions", label: "软件的主要功能(500~1300字符)" },
  { key: "technical_features", label: "软件的技术特点(100字符内)" },
  { key: "company_name", label: "公司名称" },
  { key: "credit_code", label: "统一社会信用代码" },
];

const LABEL_TO_KEY: Record<string, keyof CopyrightFormData> = {};
for (const row of MD_FIELD_ROWS) {
  LABEL_TO_KEY[row.label] = row.key;
  LABEL_TO_KEY[row.label.replace(/\(.*\)/, "").trim()] = row.key;
}
LABEL_TO_KEY["软件全称"] = "software_full_name";
LABEL_TO_KEY["软件简称"] = "software_short_name";
LABEL_TO_KEY["版本号"] = "version";
LABEL_TO_KEY["软件分类"] = "software_category";
LABEL_TO_KEY["软件开发完成日期"] = "development_date";
LABEL_TO_KEY["是否发表"] = "is_published";
LABEL_TO_KEY["源程序量"] = "source_code_lines";
LABEL_TO_KEY["公司名称"] = "company_name";
LABEL_TO_KEY["统一社会信用代码"] = "credit_code";

function formatFieldValue(key: keyof CopyrightFormData, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (key === "is_published") {
    return value === true || value === "true" || value === "已发表" ? "已发表" : "未发表";
  }
  return String(value);
}

/** 将采集表记录转为生成接口使用的 Markdown 表格 */
export function formToMarkdown(form: CopyrightFormData): string {
  const lines = [
    "### 计算机软件著作权登记信息采集表",
    "",
    "| 字段名称 | 填写内容 |",
    "| :--- | :--- |",
  ];
  for (const { key, label } of MD_FIELD_ROWS) {
    const value = formatFieldValue(key, form[key]);
    lines.push(`| **${label}** | ${value.replace(/\|/g, "\\|")} |`);
  }
  return lines.join("\n");
}

/** 从 API 响应解析为表单数据 */
export function recordToFormData(record: Record<string, unknown>): CopyrightFormData {
  const effective =
    (record.effective_form as Record<string, unknown>) || record;
  const enriched = record.enriched_data as Record<string, unknown> | null;
  const base = enriched && record.status === "enriched" ? { ...record, ...enriched } : effective;

  return {
    id: String(base.id ?? record.id ?? ""),
    user_id: String(base.user_id ?? ""),
    query_code: String(base.query_code ?? record.query_code ?? ""),
    status: String(base.status ?? record.status ?? "draft"),
    software_full_name: String(base.software_full_name ?? ""),
    software_short_name: String(base.software_short_name ?? ""),
    version: String(base.version ?? "V1.0"),
    software_category: String(base.software_category ?? ""),
    development_date: String(base.development_date ?? ""),
    is_published:
      base.is_published === true ||
      base.is_published === "true" ||
      base.is_published === "已发表",
    development_hardware: String(base.development_hardware ?? "PC机"),
    runtime_hardware: String(base.runtime_hardware ?? "PC机"),
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

/** 解析 Markdown 表格回填表单（AI 补全后使用） */
export function parseMarkdownToForm(
  markdown: string,
  base: CopyrightFormData
): CopyrightFormData {
  const result = { ...base };
  const rowRegex = /\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const label = match[1].trim();
    const value = match[2].trim();
    const key = LABEL_TO_KEY[label] ?? LABEL_TO_KEY[label.replace(/\(.*\)/, "").trim()];
    if (!key || !value) continue;
    if (key === "is_published") {
      result.is_published = value === "已发表";
    } else if (key === "source_code_lines") {
      result.source_code_lines = parseInt(value, 10) || 0;
    } else {
      (result as Record<string, string | number | boolean>)[key] = value;
    }
  }
  return result;
}

export function formToUpdatePayload(form: CopyrightFormData) {
  const { id, user_id, query_code, status, ...rest } = form;
  void id;
  void user_id;
  void query_code;
  void status;
  return { ...rest, mark_enriched: true };
}
