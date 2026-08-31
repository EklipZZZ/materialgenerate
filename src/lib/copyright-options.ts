export const SOFTWARE_CATEGORY_OPTIONS = [
  "应用软件",
  "嵌入式软件",
  "信息管理软件",
  "网络应用软件",
  "游戏软件",
  "工业软件",
  "物联网软件",
  "人工智能软件",
] as const;

export const TARGET_INDUSTRY_OPTIONS = [
  "通用/综合",
  "互联网/电子商务",
  "教育",
  "医疗健康",
  "金融",
  "工业制造",
  "物联网",
  "人工智能",
  "政务/公共服务",
  "文化娱乐",
] as const;

export const PROGRAMMING_LANGUAGE_OPTIONS = [
  "Python",
  "JavaScript / TypeScript",
  "Java",
  "C / C++",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Swift / Kotlin",
  "HTML / CSS",
] as const;

export interface ChoiceSelection {
  selected: string[];
  custom: string;
}

/**
 * Older records store these fields as one string. Split known options from
 * the remaining user-entered text so the multi-select UI can edit both
 * representations without a database migration.
 */
export function parseChoiceSelection(value: string, options: readonly string[]): ChoiceSelection {
  const parts = value
    .split(/[、,，;；]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const selected = options.filter((option) => parts.includes(option));
  const custom = parts.filter((part) => !options.includes(part)).join("、");
  return { selected, custom };
}

export function serializeChoiceSelection(selected: readonly string[], custom: string): string {
  return Array.from(new Set([
    ...selected,
    ...custom.split(/[、,，;；]/).map((part) => part.trim()).filter(Boolean),
  ])).join("、");
}
