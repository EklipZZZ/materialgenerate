import { validateCopyrightTextFields } from "./copyright-constraints.ts";

export type HolderType = "person" | "organization";
export type DevelopmentMethod = "independent" | "cooperative" | "commissioned" | "assigned_task";
export type WorkType = "original" | "modified";
export type RightsAcquisitionMethod = "original" | "transfer" | "inheritance" | "assumption";
export type RightsScope = "all" | "partial";
export type ApplicationMethod = "copyright_holder" | "agent";

export interface CopyrightHolder {
  id?: string;
  holder_type: HolderType;
  name: string;
  category: string;
  document_type: string;
  document_number: string;
  nationality: string;
  province: string;
  city: string;
  /** 仅自然人使用；数据库旧列 birth_or_established_date 保留兼容。 */
  birth_or_established_date?: string;
  sort_order: number;
}

export interface CopyrightFormData {
  id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  software_full_name: string;
  software_short_name: string;
  version: string;
  software_category: string;
  work_type: WorkType;
  development_date: string;
  is_published: boolean;
  first_publication_date: string;
  first_publication_country: string;
  first_publication_city: string;
  development_method: DevelopmentMethod;
  rights_acquisition_method: RightsAcquisitionMethod;
  rights_scope: RightsScope;
  rights_scope_description: string;
  original_registration_number: string;
  modification_description: string;
  application_method: ApplicationMethod;
  applicant_address: string;
  postal_code: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
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
  copyright_holders: CopyrightHolder[];
}

export const EMPTY_COPYRIGHT_HOLDER: CopyrightHolder = {
  holder_type: "person",
  name: "",
  category: "自然人",
  document_type: "居民身份证",
  document_number: "",
  nationality: "中国",
  province: "",
  city: "",
  birth_or_established_date: "",
  sort_order: 0,
};

export const EMPTY_COPYRIGHT_FORM: CopyrightFormData = {
  software_full_name: "",
  software_short_name: "",
  version: "V1.0",
  software_category: "",
  work_type: "original",
  development_date: "",
  is_published: false,
  first_publication_date: "",
  first_publication_country: "",
  first_publication_city: "",
  development_method: "independent",
  rights_acquisition_method: "original",
  rights_scope: "all",
  rights_scope_description: "",
  original_registration_number: "",
  modification_description: "",
  application_method: "copyright_holder",
  applicant_address: "",
  postal_code: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
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
  copyright_holders: [],
};

const MD_FIELD_ROWS: Array<{ key: keyof CopyrightFormData; label: string }> = [
  { key: "software_full_name", label: "软件全称" },
  { key: "software_short_name", label: "软件简称" },
  { key: "version", label: "版本号" },
  { key: "software_category", label: "软件分类" },
  { key: "work_type", label: "软件作品说明" },
  { key: "development_date", label: "开发完成日期" },
  { key: "is_published", label: "是否发表" },
  { key: "first_publication_date", label: "首次发表日期" },
  { key: "first_publication_country", label: "首次发表国家" },
  { key: "first_publication_city", label: "首次发表城市" },
  { key: "development_method", label: "开发方式" },
  { key: "rights_acquisition_method", label: "权利取得方式" },
  { key: "rights_scope", label: "权利范围" },
  { key: "rights_scope_description", label: "权利范围说明" },
  { key: "original_registration_number", label: "原登记号" },
  { key: "modification_description", label: "修改说明" },
  { key: "application_method", label: "申请办理方式" },
  { key: "development_hardware", label: "开发的硬件环境" },
  { key: "runtime_hardware", label: "运行的硬件环境" },
  { key: "development_os", label: "开发操作系统" },
  { key: "development_tools", label: "软件开发环境工具" },
  { key: "runtime_platform", label: "运行平台操作系统" },
  { key: "runtime_environment", label: "软件运行支撑环境" },
  { key: "programming_language", label: "编程语言" },
  { key: "source_code_lines", label: "源码代码行数" },
  { key: "development_purpose", label: "开发目的" },
  { key: "target_industry", label: "面向领域/行业" },
  { key: "main_functions", label: "软件的主要功能" },
  { key: "technical_features", label: "软件技术特点" },
  { key: "company_name", label: "兼容旧字段：公司名称" },
  { key: "credit_code", label: "兼容旧字段：统一社会信用代码" },
];

const LABEL_TO_KEY = Object.fromEntries(
  [
    ...MD_FIELD_ROWS,
    { key: "development_hardware", label: "开发硬件环境" },
    { key: "runtime_hardware", label: "运行硬件环境" },
    { key: "development_tools", label: "开发工具" },
    { key: "runtime_platform", label: "运行平台" },
    { key: "runtime_environment", label: "运行环境" },
    { key: "source_code_lines", label: "源程序量" },
    { key: "main_functions", label: "主要功能" },
    { key: "technical_features", label: "技术特点" },
  ].map(({ key, label }) => [label, key]),
) as Record<string, keyof CopyrightFormData>;

const workTypeLabels: Record<WorkType, string> = {
  original: "原创",
  modified: "修改",
};

const developmentMethodLabels: Record<DevelopmentMethod, string> = {
  independent: "单独开发",
  cooperative: "合作开发",
  commissioned: "委托开发",
  assigned_task: "下达任务开发",
};

const acquisitionLabels: Record<RightsAcquisitionMethod, string> = {
  original: "原始取得",
  transfer: "受让",
  inheritance: "继承",
  assumption: "承受",
};

const applicationMethodLabels: Record<ApplicationMethod, string> = {
  copyright_holder: "著作权人申请办理",
  agent: "代理人申请办理",
};

function holderSummary(holders: CopyrightHolder[]): string {
  return holders
    .filter((holder) => holder.name.trim())
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((holder) => `${holder.name}（${holder.holder_type === "person" ? "自然人" : "单位"}）`)
    .join("；");
}

function holderDetails(holders: CopyrightHolder[]): string {
  return holders
    .filter((holder) => holder.name.trim() || holder.document_number.trim())
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((holder) => {
      const type = holder.holder_type === "person" ? "自然人" : "单位";
      const location = [holder.nationality, holder.province, holder.city].filter(Boolean).join("/");
      const date = holder.holder_type === "person" && holder.birth_or_established_date
        ? `，出生日期：${holder.birth_or_established_date}`
        : "";
      return `${holder.name}（${type}；${holder.category}；${holder.document_type}：${holder.document_number}；${location || "未填写地区"}${date}）`;
    })
    .join("；");
}

function formatFieldValue(key: keyof CopyrightFormData, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (key === "is_published") return value === true ? "已发表" : "未发表";
  if (key === "work_type") return workTypeLabels[value as WorkType] || String(value);
  if (key === "development_method") return developmentMethodLabels[value as DevelopmentMethod] || String(value);
  if (key === "rights_acquisition_method") return acquisitionLabels[value as RightsAcquisitionMethod] || String(value);
  if (key === "application_method") return applicationMethodLabels[value as ApplicationMethod] || String(value);
  if (key === "rights_scope") return value === "all" ? "全部权利" : "部分权利";
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
    const rawValue = key === "company_name" && !form.company_name
      ? holderSummary(form.copyright_holders)
      : form[key];
    const value = formatFieldValue(key, rawValue).replace(/\|/g, "\\|");
    lines.push("| **" + label + "** | " + value + " |");
  }
  const details = holderDetails(form.copyright_holders);
  if (details) lines.push("| **著作权人明细** | " + details.replace(/\|/g, "\\|") + " |");
  return lines.join("\n");
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value === null || value === undefined ? fallback : String(value);
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "已发表";
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function normalizeHolder(value: unknown, index: number): CopyrightHolder | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const holderType = asEnum(item.holder_type ?? item.holderType, ["person", "organization"] as const, "person");
  const name = asString(item.name).trim();
  const documentNumber = asString(item.document_number ?? item.documentNumber).trim();
  if (!name && !documentNumber) return null;
  return {
    id: asString(item.id) || undefined,
    holder_type: holderType,
    name,
    category: asString(item.category, holderType === "person" ? "自然人" : "企业法人"),
    document_type: asString(item.document_type ?? item.documentType, holderType === "person" ? "居民身份证" : "统一社会信用代码证书"),
    document_number: documentNumber,
    nationality: asString(item.nationality, "中国"),
    province: asString(item.province),
    city: asString(item.city),
    ...(holderType === "person"
      ? { birth_or_established_date: asString(item.birth_or_established_date ?? item.birthOrEstablishedDate) }
      : {}),
    sort_order: Number.isFinite(Number(item.sort_order ?? item.sortOrder)) ? Number(item.sort_order ?? item.sortOrder) : index,
  };
}

function legacyHolder(record: Record<string, unknown>): CopyrightHolder[] {
  const companyName = asString(record.company_name).trim();
  const creditCode = asString(record.credit_code).trim();
  if (!companyName && !creditCode) return [];
  return [{
    ...EMPTY_COPYRIGHT_HOLDER,
    holder_type: "organization",
    category: "企业法人",
    document_type: "统一社会信用代码证书",
    name: companyName,
    document_number: creditCode,
    sort_order: 0,
  }];
}

export function recordToFormData(record: Record<string, unknown>): CopyrightFormData {
  const enriched = record.enriched_data as Record<string, unknown> | null;
  const base = enriched ? { ...record, ...enriched } : record;
  const rawHolders = Array.isArray(base.copyright_holders) ? base.copyright_holders : [];
  const holders = rawHolders.map(normalizeHolder).filter((holder): holder is CopyrightHolder => Boolean(holder));
  return {
    id: asString(base.id) || undefined,
    status: asString(base.status, "draft"),
    created_at: asString(base.created_at),
    updated_at: asString(base.updated_at),
    software_full_name: asString(base.software_full_name),
    software_short_name: asString(base.software_short_name),
    version: asString(base.version, "V1.0"),
    software_category: asString(base.software_category),
    work_type: asEnum(base.work_type, ["original", "modified"] as const, "original"),
    development_date: asString(base.development_date),
    is_published: asBoolean(base.is_published),
    first_publication_date: asString(base.first_publication_date),
    first_publication_country: asString(base.first_publication_country),
    first_publication_city: asString(base.first_publication_city),
    development_method: asEnum(base.development_method, ["independent", "cooperative", "commissioned", "assigned_task"] as const, "independent"),
    rights_acquisition_method: asEnum(base.rights_acquisition_method, ["original", "transfer", "inheritance", "assumption"] as const, "original"),
    rights_scope: asEnum(base.rights_scope, ["all", "partial"] as const, "all"),
    rights_scope_description: asString(base.rights_scope_description),
    original_registration_number: asString(base.original_registration_number),
    modification_description: asString(base.modification_description),
    application_method: asEnum(base.application_method, ["copyright_holder", "agent"] as const, "copyright_holder"),
    applicant_address: asString(base.applicant_address),
    postal_code: asString(base.postal_code),
    contact_name: asString(base.contact_name),
    contact_phone: asString(base.contact_phone),
    contact_email: asString(base.contact_email),
    development_hardware: asString(base.development_hardware, "PC"),
    runtime_hardware: asString(base.runtime_hardware, "PC"),
    development_os: asString(base.development_os, "Windows 10"),
    development_tools: asString(base.development_tools),
    runtime_platform: asString(base.runtime_platform, "Windows 10"),
    runtime_environment: asString(base.runtime_environment),
    programming_language: asString(base.programming_language),
    source_code_lines: Number(base.source_code_lines ?? 0) || 0,
    development_purpose: asString(base.development_purpose),
    target_industry: asString(base.target_industry),
    main_functions: asString(base.main_functions),
    technical_features: asString(base.technical_features),
    company_name: asString(base.company_name),
    credit_code: asString(base.credit_code),
    copyright_holders: holders.length ? holders : legacyHolder(base),
  };
}

export function formToUpdatePayload(form: CopyrightFormData) {
  const { id, status, created_at, updated_at, ...rest } = form;
  void id;
  void status;
  void created_at;
  void updated_at;
  return {
    ...rest,
    copyright_holders: rest.copyright_holders.map((holder) => {
      if (holder.holder_type === "person") return holder;
      const { birth_or_established_date, ...organization } = holder;
      void birth_or_established_date;
      return organization;
    }),
  };
}

/**
 * Send the current unsaved technical draft to AI enrichment. Sensitive
 * identity, rights, applicant, and contact fields intentionally stay out of
 * this payload. Empty values are included so a user-cleared field cannot be
 * replaced by an older value that is still stored on the server.
 */
export function formToEnrichmentDraft(form: CopyrightFormData): Record<string, unknown> {
  return {
    software_full_name: form.software_full_name,
    software_short_name: form.software_short_name,
    version: form.version,
    software_category: form.software_category,
    development_hardware: form.development_hardware,
    runtime_hardware: form.runtime_hardware,
    development_os: form.development_os,
    development_tools: form.development_tools,
    runtime_platform: form.runtime_platform,
    runtime_environment: form.runtime_environment,
    programming_language: form.programming_language,
    source_code_lines: form.source_code_lines,
    development_purpose: form.development_purpose,
    target_industry: form.target_industry,
    main_functions: form.main_functions,
    technical_features: form.technical_features,
  };
}

export function validateCopyrightForm(form: CopyrightFormData, requireMainFunctions = false): string[] {
  return validateCopyrightTextFields(form as unknown as Record<string, unknown>, { requireMainFunctions });
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
    else if (key === "work_type") result.work_type = value.includes("修改") ? "modified" : "original";
    else if (key === "development_method") {
      const entry = Object.entries(developmentMethodLabels).find(([, label]) => label === value);
      if (entry) result.development_method = entry[0] as DevelopmentMethod;
    } else if (key === "rights_acquisition_method") {
      const entry = Object.entries(acquisitionLabels).find(([, label]) => label === value);
      if (entry) result.rights_acquisition_method = entry[0] as RightsAcquisitionMethod;
    } else if (key === "application_method") {
      const entry = Object.entries(applicationMethodLabels).find(([, label]) => label === value);
      if (entry) result.application_method = entry[0] as ApplicationMethod;
    } else if (key === "rights_scope") result.rights_scope = value.includes("部分") ? "partial" : "all";
    else (result as unknown as Record<string, string | number | boolean>)[key] = value;
  }
  return result;
}
