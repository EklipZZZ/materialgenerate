export const COPYRIGHT_SHORT_TEXT_MAX = 50;
export const COPYRIGHT_TECHNICAL_FEATURES_MAX = 100;
export const COPYRIGHT_MAIN_FUNCTIONS_MIN = 500;
export const COPYRIGHT_MAIN_FUNCTIONS_MAX = 1300;

export const COPYRIGHT_50_CHAR_FIELDS = [
  "development_hardware",
  "runtime_hardware",
  "development_os",
  "development_tools",
  "runtime_platform",
  "runtime_environment",
  "programming_language",
  "development_purpose",
  "target_industry",
] as const;

export const COPYRIGHT_FIELD_LIMITS = {
  software_category: 50,
  development_hardware: COPYRIGHT_SHORT_TEXT_MAX,
  runtime_hardware: COPYRIGHT_SHORT_TEXT_MAX,
  development_os: COPYRIGHT_SHORT_TEXT_MAX,
  development_tools: COPYRIGHT_SHORT_TEXT_MAX,
  runtime_platform: COPYRIGHT_SHORT_TEXT_MAX,
  runtime_environment: COPYRIGHT_SHORT_TEXT_MAX,
  programming_language: COPYRIGHT_SHORT_TEXT_MAX,
  development_purpose: COPYRIGHT_SHORT_TEXT_MAX,
  target_industry: COPYRIGHT_SHORT_TEXT_MAX,
  technical_features: COPYRIGHT_TECHNICAL_FEATURES_MAX,
  main_functions: COPYRIGHT_MAIN_FUNCTIONS_MAX,
} as const;

export function characterCount(value: unknown): number {
  return typeof value === "string" ? Array.from(value).length : 0;
}

export function isMainFunctionsComplete(value: unknown): boolean {
  const count = characterCount(value);
  return count >= COPYRIGHT_MAIN_FUNCTIONS_MIN && count <= COPYRIGHT_MAIN_FUNCTIONS_MAX;
}

export function validateCopyrightTextFields(
  row: Record<string, unknown>,
  options: { requireMainFunctions?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const labels: Record<string, string> = {
    software_category: "软件分类",
    development_hardware: "开发的硬件环境",
    runtime_hardware: "运行的硬件环境",
    development_os: "开发操作系统",
    development_tools: "软件开发环境工具",
    runtime_platform: "运行平台操作系统",
    runtime_environment: "软件运行支撑环境",
    programming_language: "编程语言",
    development_purpose: "开发目的",
    target_industry: "面向领域行业",
    technical_features: "软件技术特点",
    main_functions: "软件的主要功能",
  };

  for (const [field, limit] of Object.entries(COPYRIGHT_FIELD_LIMITS)) {
    const value = row[field];
    if (typeof value !== "string" || !value.trim()) continue;
    const count = characterCount(value.trim());
    if (field === "main_functions") {
      if (count < COPYRIGHT_MAIN_FUNCTIONS_MIN || count > COPYRIGHT_MAIN_FUNCTIONS_MAX) {
        errors.push(`${labels[field]}需填写 ${COPYRIGHT_MAIN_FUNCTIONS_MIN}～${COPYRIGHT_MAIN_FUNCTIONS_MAX} 字符，当前 ${count} 字符`);
      }
      continue;
    }
    if (count > limit) errors.push(`${labels[field]}不能超过 ${limit} 字符，当前 ${count} 字符`);
  }

  if (options.requireMainFunctions && !isMainFunctionsComplete(row.main_functions)) {
    const count = characterCount(row.main_functions);
    if (!errors.some((message) => message.startsWith("软件的主要功能"))) {
      errors.push(`软件的主要功能需填写 ${COPYRIGHT_MAIN_FUNCTIONS_MIN}～${COPYRIGHT_MAIN_FUNCTIONS_MAX} 字符，当前 ${count} 字符`);
    }
  }

  return errors;
}
