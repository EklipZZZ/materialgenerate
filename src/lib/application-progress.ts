import type { CopyrightFormData } from "@/lib/copyright-form";

const completionFields: Array<keyof CopyrightFormData> = [
  "software_full_name",
  "software_short_name",
  "software_category",
  "development_date",
  "development_tools",
  "runtime_platform",
  "programming_language",
  "development_purpose",
  "target_industry",
  "main_functions",
  "technical_features",
  "company_name",
  "credit_code",
];

function hasValue(value: unknown): boolean {
  if (typeof value === "number") return value > 0;
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

export function getApplicationProgress(form: CopyrightFormData): {
  completed: number;
  total: number;
  percent: number;
} {
  const completed = completionFields.filter((field) => hasValue(form[field])).length;
  return {
    completed,
    total: completionFields.length,
    percent: Math.round((completed / completionFields.length) * 100),
  };
}

export function getApplicationStatus(form: CopyrightFormData): "editing" | "ready" {
  return getApplicationProgress(form).percent === 100 ? "ready" : "editing";
}
