export const formFields = [
  "software_full_name",
  "software_short_name",
  "version",
  "software_category",
  "development_date",
  "is_published",
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

const labels: Record<string, string> = {
  software_full_name: "软件全称",
  software_short_name: "软件简称",
  version: "版本号",
  software_category: "软件分类",
  development_date: "开发完成日期",
  is_published: "是否发表",
  development_hardware: "开发硬件环境",
  runtime_hardware: "运行硬件环境",
  development_os: "开发操作系统",
  development_tools: "开发工具",
  runtime_platform: "运行平台",
  runtime_environment: "运行环境",
  programming_language: "编程语言",
  source_code_lines: "源程序量",
  development_purpose: "开发目的",
  target_industry: "面向领域/行业",
  main_functions: "主要功能",
  technical_features: "技术特点",
  company_name: "公司名称",
  credit_code: "统一社会信用代码",
};

export function snapshotFields(row: Record<string, unknown>) {
  return Object.fromEntries(formFields.filter((key) => row[key] !== undefined).map((key) => [key, row[key]]));
}

export function formToMarkdown(row: Record<string, unknown>): string {
  const lines = [
    "### 计算机软件著作权登记信息采集表",
    "",
    "| 字段名称 | 填写内容 |",
    "| :--- | :--- |",
  ];
  for (const key of formFields) {
    const value = key === "is_published"
      ? row[key] === true ? "已发表" : "未发表"
      : String(row[key] ?? "");
    lines.push("| **" + labels[key] + "** | " + value.replace(/\|/g, "\\|") + " |");
  }
  return lines.join("\n");
}

export function parseEnrichedMarkdown(markdown: string, base: Record<string, unknown>) {
  const result = { ...base };
  const labelToKey = Object.fromEntries(Object.entries(labels).map(([key, label]) => [label, key]));
  const rowRegex = /\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const key = labelToKey[match[1].trim()];
    if (!key || !match[2].trim()) continue;
    if (key === "is_published") result[key] = match[2].trim() === "已发表";
    else if (key === "source_code_lines") result[key] = Number.parseInt(match[2], 10) || 0;
    else result[key] = match[2].trim();
  }
  return result;
}
