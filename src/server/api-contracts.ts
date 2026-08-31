import { z } from "zod";
import { llmConfigInputSchema } from "./models.ts";

const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(20_000);
const dateText = z.string().trim().max(40);

export const applicationIdSchema = z.string().uuid();
export const materialIdSchema = z.string().uuid();
export const generationJobIdSchema = z.string().uuid();
export const generationRecordIdSchema = z.string().uuid();
export const llmConfigIdSchema = z.string().uuid();

export const copyrightHolderFields = z.object({
  id: z.string().uuid().optional(),
  holder_type: z.enum(["person", "organization"]),
  name: shortText.min(1, "请填写著作权人名称"),
  category: shortText.min(1, "请填写著作权人类别"),
  document_type: shortText.min(1, "请选择证件类型"),
  document_number: shortText.min(1, "请填写证件号码"),
  nationality: shortText.min(1, "请填写国籍"),
  province: shortText,
  city: shortText,
  park: shortText.optional(),
  birth_or_established_date: dateText.optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
}).strict().meta({
  id: "CopyrightHolderInput",
  description: "自然人或企业/单位著作权人信息。",
});

export const applicationFields = z.object({
  software_full_name: shortText.optional(),
  software_short_name: shortText.optional(),
  version: shortText.optional(),
  software_category: shortText.optional(),
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
  development_hardware: longText.optional(),
  runtime_hardware: longText.optional(),
  development_os: longText.optional(),
  development_tools: longText.optional(),
  runtime_platform: longText.optional(),
  runtime_environment: longText.optional(),
  programming_language: longText.optional(),
  source_code_lines: z.number().int().min(0).max(1_000_000_000).optional(),
  development_purpose: longText.optional(),
  target_industry: longText.optional(),
  main_functions: longText.optional(),
  technical_features: longText.optional(),
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

export const sourceUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
  size: z.number().int().positive().max(100 * 1024 * 1024),
}).meta({
  id: "SourceUploadRequest",
  description: "源码 ZIP、TAR.GZ 或 TGZ 压缩包的上传授权请求。",
});

export const enrichRequestSchema = z.object({
  applicationId: applicationIdSchema,
  llmConfigId: llmConfigIdSchema,
}).meta({
  id: "EnrichRequest",
  description: "使用已保存的模型配置补全申请信息。",
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
