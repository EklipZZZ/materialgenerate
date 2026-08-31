export const SOURCE_FEEDBACK_FIELDS = [
  "software_full_name",
  "software_short_name",
  "version",
  "software_category",
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
] as const;

export type SourceFeedbackField = typeof SOURCE_FEEDBACK_FIELDS[number];

export const sourceFeedbackFieldLabels: Record<SourceFeedbackField, string> = {
  software_full_name: "软件全称",
  software_short_name: "软件简称",
  version: "版本号",
  software_category: "软件分类",
  development_hardware: "开发的硬件环境",
  runtime_hardware: "运行的硬件环境",
  development_os: "开发操作系统",
  development_tools: "软件开发环境工具",
  runtime_platform: "运行平台操作系统",
  runtime_environment: "软件运行支撑环境",
  programming_language: "编程语言",
  source_code_lines: "源码代码行数",
  development_purpose: "开发目的",
  target_industry: "面向领域行业",
  main_functions: "软件的主要功能",
  technical_features: "软件技术特点",
};

export interface SourceFeedbackSuggestion {
  field: SourceFeedbackField;
  label: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
}

export interface SourceFeedbackResponse {
  sourceSummary: string;
  fileCount: number;
  sourceCodeLines: number;
  suggestions: SourceFeedbackSuggestion[];
}
