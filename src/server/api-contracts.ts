import { z } from "zod";
import { llmConfigInputSchema } from "./models.ts";
import {
  COPYRIGHT_MAIN_FUNCTIONS_MAX,
  COPYRIGHT_SHORT_TEXT_MAX,
  COPYRIGHT_TECHNICAL_FEATURES_MAX,
} from "../lib/copyright-constraints.ts";
import { SOURCE_FEEDBACK_FIELDS } from "../lib/source-feedback.ts";

const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(20_000);
const dateText = z.string().trim().max(40);
const registrationShortText = z.string().trim().max(COPYRIGHT_SHORT_TEXT_MAX);
const technicalFeaturesText = z.string().trim().max(COPYRIGHT_TECHNICAL_FEATURES_MAX);
// Drafts may be blank or shorter than the official minimum. The final
// generation endpoint applies the required 500-character gate separately.
const mainFunctionsText = z.string().trim().max(COPYRIGHT_MAIN_FUNCTIONS_MAX);

export const applicationIdSchema = z.string().uuid();
export const materialIdSchema = z.string().uuid();
export const generationJobIdSchema = z.string().uuid();
export const generationRecordIdSchema = z.string().uuid();
export const llmConfigIdSchema = z.string().uuid();

const copyrightHolderCommonFields = {
  id: z.string().uuid().optional(),
  name: shortText.min(1, "请填写著作权人名称"),
  category: shortText.min(1, "请填写著作权人类别"),
  document_type: shortText.min(1, "请选择证件类型"),
  document_number: shortText.min(1, "请填写证件号码"),
  nationality: shortText.min(1, "请填写国籍"),
  province: shortText,
  city: shortText,
  sort_order: z.number().int().min(0).max(1000).optional(),
};

const personHolderFields = z.object({
  ...copyrightHolderCommonFields,
  holder_type: z.literal("person"),
  birth_or_established_date: dateText.optional(),
}).strict();

const organizationHolderFields = z.object({
  ...copyrightHolderCommonFields,
  holder_type: z.literal("organization"),
}).strict();

export const copyrightHolderFields = z.discriminatedUnion("holder_type", [personHolderFields, organizationHolderFields]).meta({
  id: "CopyrightHolderInput",
  description: "自然人或企业/单位著作权人信息。自然人可以填写出生日期，企业/单位不采集日期字段。",
});

export const applicationFields = z.object({
  software_full_name: shortText.optional(),
  software_short_name: shortText.optional(),
  version: shortText.optional(),
  software_category: registrationShortText.optional(),
  work_type: z.enum(["original", "modified"]).optional(),
  development_date: dateText.optional(),
  is_published: z.boolean().optional(),
  first_publication_date: dateText.optional(),
  first_publication_country: shortText.optional(),
  first_publication_city: shortText.optional(),
  development_method: z.enum(["independent", "cooperative", "commissioned", "assigned_task"]).optional(),
  rights_acquisition_method: z.enum(["original", "transfer", "inheritance", "assumption"]).optional(),
  rights_scope: z.enum(["all", "partial"]).optional(),
  rights_scope_description: longText.optional(),
  original_registration_number: shortText.optional(),
  modification_description: longText.optional(),
  application_method: z.enum(["copyright_holder", "agent"]).optional(),
  applicant_address: longText.optional(),
  postal_code: shortText.optional(),
  contact_name: shortText.optional(),
  contact_phone: shortText.optional(),
  contact_email: shortText.optional(),
  development_hardware: registrationShortText.optional(),
  runtime_hardware: registrationShortText.optional(),
  development_os: registrationShortText.optional(),
  development_tools: registrationShortText.optional(),
  runtime_platform: registrationShortText.optional(),
  runtime_environment: registrationShortText.optional(),
  programming_language: registrationShortText.optional(),
  source_code_lines: z.number().int().min(0).max(1_000_000_000).optional(),
  development_purpose: registrationShortText.optional(),
  target_industry: registrationShortText.optional(),
  main_functions: mainFunctionsText.optional(),
  technical_features: technicalFeaturesText.optional(),
  // These columns remain for old applications and old pages.
  company_name: shortText.optional(),
  credit_code: shortText.optional(),
}).strict().meta({
  id: "ApplicationFields",
  description: "软件著作权申请主体及软件信息字段。",
});

export const applicationPayloadFields = applicationFields.extend({
  copyright_holders: z.array(copyrightHolderFields).max(50).optional(),
}).meta({
  id: "ApplicationPayload",
  description: "创建或更新申请时使用的请求体。",
});

const enrichDraftFields = applicationFields.pick({
  software_full_name: true,
  software_short_name: true,
  version: true,
  software_category: true,
  development_hardware: true,
  runtime_hardware: true,
  development_os: true,
  development_tools: true,
  runtime_platform: true,
  runtime_environment: true,
  programming_language: true,
  source_code_lines: true,
  development_purpose: true,
  target_industry: true,
  main_functions: true,
  technical_features: true,
}).partial().meta({
  id: "EnrichDraft",
  description: "当前页面尚未保存的技术字段草稿；不包含著作权人、证件、权利和联系方式。",
});

export const sourceUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
  size: z.number().int().positive().max(100 * 1024 * 1024),
}).meta({
  id: "SourceUploadRequest",
  description: "源码 ZIP、TAR.GZ 或 TGZ 压缩包的上传授权请求。",
});

export const sourceFeedbackFieldSchema = z.enum(SOURCE_FEEDBACK_FIELDS);

export const sourceFeedbackRequestSchema = z.object({
  applicationId: applicationIdSchema,
  llmConfigId: llmConfigIdSchema,
  sourceObjectKey: z.string().trim().min(1).max(500),
  sourceFileName: z.string().trim().min(1).max(200),
}).meta({
  id: "SourceFeedbackRequest",
  description: "根据用户上传的源码压缩包生成申请信息修正建议。建议需要用户确认后才会写回申请。",
});

export const sourceFeedbackSuggestionResponseSchema = z.object({
  field: sourceFeedbackFieldSchema,
  label: z.string(),
  currentValue: z.string(),
  suggestedValue: z.string(),
  reason: z.string(),
}).meta({
  id: "SourceFeedbackSuggestion",
});

export const sourceFeedbackResponseSchema = z.object({
  sourceSummary: z.string(),
  fileCount: z.number().int().min(0),
  sourceCodeLines: z.number().int().min(0),
  suggestions: z.array(sourceFeedbackSuggestionResponseSchema),
}).meta({
  id: "SourceFeedbackResponse",
  description: "源码分析结果和待用户确认的申请信息建议。",
});

export const enrichRequestSchema = z.object({
  applicationId: applicationIdSchema,
  llmConfigId: llmConfigIdSchema,
  draft: enrichDraftFields.optional(),
  regenerateMainFunctions: z.boolean().optional().default(false),
}).meta({
  id: "EnrichRequest",
  description: "使用已保存的模型配置补全申请信息；可携带当前页面草稿，并明确要求重写软件主要功能。",
});

export const generateRequestSchema = z.object({
  applicationId: applicationIdSchema,
  llmConfigId: llmConfigIdSchema,
  tableTemplate: z.string().max(300_000).optional().default(""),
  skipAnalyze: z.boolean().optional().default(false),
  sourceObjectKey: z.string().trim().max(500).optional(),
  sourceFileName: z.string().trim().max(200).optional(),
}).meta({
  id: "GenerateRequest",
  description: "启动软著材料生成任务。生成接口以 SSE 返回进度事件。",
});

export const llmTestRequestSchema = z.object({
  llmConfigId: llmConfigIdSchema,
}).meta({
  id: "LlmTestRequest",
  description: "测试已保存的模型配置。",
});

export const llmConfigWriteSchema = llmConfigInputSchema.extend({
  id: llmConfigIdSchema.optional(),
}).meta({
  id: "LlmConfigWriteRequest",
  description: "保存或更新模型配置。apiKey 只接收写入，不在响应中返回。",
});

export const materialKindSchema = z.enum([
  "source_code_docx",
  "source_code_pdf",
  "user_manual_docx",
  "user_manual_pdf",
  "application_summary_pdf",
  "cooperation_agreement",
  "signature_page",
  "holder_identity_proof",
  "commission_agreement",
  "task_order",
]);

export const materialUploadSchema = z.object({
  kind: materialKindSchema,
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
  size: z.number().int().positive().max(30 * 1024 * 1024),
  holderId: z.string().uuid().optional(),
}).meta({
  id: "MaterialUploadRequest",
  description: "申请材料的 signed upload 授权请求。",
});

export const materialCompleteSchema = z.object({
  materialId: materialIdSchema,
  size: z.number().int().positive().max(30 * 1024 * 1024).optional(),
  checksum: z.string().trim().max(200).optional(),
}).meta({
  id: "MaterialCompleteRequest",
  description: "确认材料已通过 Supabase signed upload 上传。",
});

export const downloadKindSchema = z.enum([
  "source_code",
  "source_code_pdf",
  "user_manual",
  "user_manual_pdf",
  "application_summary_pdf",
  "collection_form",
]);
