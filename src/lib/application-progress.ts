import type { CopyrightFormData } from "@/lib/copyright-form";

const completionFields: Array<keyof CopyrightFormData> = [
  "software_full_name",
  "software_short_name",
  "software_category",
  "development_date",
  "development_method",
  "development_tools",
  "runtime_platform",
  "programming_language",
  "development_purpose",
  "target_industry",
  "main_functions",
  "technical_features",
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
  const fieldsCompleted = completionFields.filter((field) => hasValue(form[field])).length;
  const holdersCompleted = form.copyright_holders.length > 0 && form.copyright_holders.every((holder) => (
    hasValue(holder.name)
    && hasValue(holder.document_type)
    && hasValue(holder.document_number)
    && hasValue(holder.nationality)
    && hasValue(holder.province)
    && hasValue(holder.city)
  ));
  const completed = fieldsCompleted + (holdersCompleted ? 1 : 0);
  const total = completionFields.length + 1;
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}

export function getApplicationStatus(form: CopyrightFormData): "editing" | "ready" {
  return getApplicationProgress(form).percent === 100 ? "ready" : "editing";
}
