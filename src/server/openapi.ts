import { z } from "zod";
import { createDocument } from "zod-openapi";
import {
  applicationIdSchema,
  applicationPayloadFields,
  copyrightHolderFields,
  downloadKindSchema,
  enrichRequestSchema,
  generateRequestSchema,
  generationJobIdSchema,
  generationRecordIdSchema,
  llmConfigIdSchema,
  llmConfigWriteSchema,
  materialCompleteSchema,
  materialIdSchema,
  materialKindSchema,
  materialUploadSchema,
  pdfRenderRequestSchema,
  sourceUploadSchema,
  sourceFeedbackRequestSchema,
  sourceFeedbackResponseSchema,
  llmTestRequestSchema,
} from "./api-contracts.ts";

type AnySchema = z.ZodType;

const apiErrorSchema = z.object({
  code: z.number().int().meta({ description: "HTTP 状态码。" }),
  msg: z.string().meta({ description: "面向用户的结果或错误说明。" }),
  data: z.null(),
}).meta({
  id: "ApiError",
  description: "统一错误响应。",
});

const applicationResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.string(),
  copyright_holders: z.array(copyrightHolderFields).optional(),
  effective_form: z.object({}).passthrough().optional(),
}).passthrough().meta({
  id: "Application",
  description: "申请记录及其著作权人信息。其余软件字段与 ApplicationFields 对齐。",
});

const materialResponseSchema = z.object({
  id: z.string().uuid(),
  application_id: z.string().uuid(),
  generation_record_id: z.string().uuid().nullable().optional(),
  holder_id: z.string().uuid().nullable().optional(),
  kind: materialKindSchema,
  status: z.enum(["missing", "generated", "uploaded", "awaiting_official", "awaiting_user", "invalid"]),
  required: z.boolean(),
  source: z.enum(["generated", "uploaded", "official"]),
  file_name: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  size_bytes: z.number().nullable().optional(),
  checksum: z.string().nullable().optional(),
  download_url: z.string().url().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).meta({
  id: "ApplicationMaterial",
  description: "申请材料及其状态。",
});

const materialsResponseSchema = z.object({
  materials: z.array(materialResponseSchema),
  summary: z.object({
    complete: z.boolean(),
    requiredCount: z.number().int(),
    readyCount: z.number().int(),
  }),
}).meta({
  id: "MaterialsResponse",
});

const generationJobSchema = z.object({
  id: generationJobIdSchema,
  user_id: z.string().uuid(),
  application_id: applicationIdSchema,
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  current_step: z.string(),
  progress: z.number().int().min(0).max(100),
  provider: z.enum(["openai", "deepseek"]).nullable(),
  model: z.string().nullable(),
  error_message: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).meta({
  id: "GenerationJob",
});

const jobEventSchema = z.object({
  id: z.string().uuid(),
  job_id: generationJobIdSchema,
  step: z.string(),
  message: z.string(),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  metadata: z.object({}).passthrough().nullable().optional(),
  created_at: z.string(),
}).meta({
  id: "JobEvent",
});

const jobWithEventsSchema = z.object({
  job: generationJobSchema,
  events: z.array(jobEventSchema),
}).meta({
  id: "GenerationJobWithEvents",
});

const publicLlmConfigSchema = z.object({
  id: llmConfigIdSchema,
  name: z.string(),
  provider: z.enum(["openai", "deepseek"]),
  model: z.string(),
  keyLast4: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({
  id: "PublicLlmConfig",
  description: "模型配置公开信息，不包含完整 API Key。",
});

const sourceUploadAuthorizationSchema = z.object({
  path: z.string(),
  token: z.string(),
  contentType: z.string(),
}).meta({
  id: "SourceUploadAuthorization",
  description: "源码直传 Supabase Storage 所需的临时授权。",
});

const materialUploadAuthorizationSchema = z.object({
  material: materialResponseSchema,
  path: z.string(),
  token: z.string(),
  contentType: z.string(),
}).meta({
  id: "MaterialUploadAuthorization",
  description: "材料直传 Supabase Storage 所需的临时授权。",
});

const generationRecordSchema = z.object({
  id: generationRecordIdSchema,
  application_id: applicationIdSchema,
  file_name: z.string(),
  provider: z.enum(["openai", "deepseek"]),
  model: z.string(),
  status: z.enum(["pending", "completed", "failed", "unavailable"]),
  created_at: z.string(),
  updated_at: z.string(),
}).meta({
  id: "GenerationRecord",
});

const healthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
}).meta({
  id: "HealthResponse",
});

function apiEnvelope(data: AnySchema): AnySchema {
  return z.object({
    code: z.number().int(),
    msg: z.string(),
    data,
  });
}

function jsonRequest(schema: AnySchema, required = true) {
  return {
    required,
    content: {
      "application/json": { schema },
    },
  };
}

function jsonResponse(schema: AnySchema, description = "操作成功") {
  return {
    description,
    content: {
      "application/json": { schema: apiEnvelope(schema) },
    },
  };
}

const standardErrorResponses = {
  "400": {
    description: "请求参数无效。",
    content: { "application/json": { schema: apiErrorSchema } },
  },
  "401": {
    description: "未登录或登录凭证无效。",
    content: { "application/json": { schema: apiErrorSchema } },
  },
  "404": {
    description: "资源不存在或不属于当前用户。",
    content: { "application/json": { schema: apiErrorSchema } },
  },
  "409": {
    description: "当前资源状态冲突，例如申请已有运行中的生成任务。",
    content: { "application/json": { schema: apiErrorSchema } },
  },
  "500": {
    description: "服务器或上游服务处理失败。",
    content: { "application/json": { schema: apiErrorSchema } },
  },
};

function responses(success: AnySchema, description = "操作成功") {
  return {
    ...standardErrorResponses,
    "200": jsonResponse(success, description),
  };
}

const applicationPath = z.object({
  id: applicationIdSchema.meta({ description: "申请 UUID。" }),
});

const materialPath = z.object({
  id: applicationIdSchema.meta({ description: "申请 UUID。" }),
  materialId: materialIdSchema.meta({ description: "材料 UUID。" }),
});

const generationJobPath = z.object({
  id: generationJobIdSchema.meta({ description: "生成任务 UUID。" }),
});

const generationDownloadPath = z.object({
  id: generationRecordIdSchema.meta({ description: "生成记录 UUID。" }),
  kind: downloadKindSchema.meta({ description: "下载文件类型。" }),
});

const llmConfigPath = z.object({
  id: llmConfigIdSchema.meta({ description: "模型配置 UUID。" }),
});

export function buildOpenApiDocument() {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "软著申报助手 API",
      version: "0.1.0",
      description: "软著申请信息、材料包和生成任务接口。所有示例均为虚构数据。",
    },
    servers: [{ url: "/", description: "当前部署环境" }],
    tags: [
      { name: "申请", description: "软件著作权申请及著作权人信息。" },
      { name: "材料", description: "DOCX、PDF、合作协议和签章页等材料。" },
      { name: "生成", description: "申请信息补全、材料生成和任务状态。" },
      { name: "模型配置", description: "当前用户的 LLM 配置。" },
      { name: "历史记录", description: "生成历史和临时下载链接。" },
      { name: "辅助/内部", description: "源码上传、健康检查和兼容接口。" },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase Auth access token。",
        },
        internalPdfSecret: {
          type: "apiKey",
          in: "header",
          name: "x-pdf-secret",
          description: "仅供服务端生成流程使用的内部共享密钥。",
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["辅助/内部"],
          summary: "检查服务健康状态",
          security: [],
          responses: {
            "200": jsonResponse(healthSchema),
          },
        },
      },
      "/api/applications": {
        get: {
          tags: ["申请"],
          summary: "获取当前用户的申请列表",
          responses: responses(z.array(applicationResponseSchema)),
        },
        post: {
          tags: ["申请"],
          summary: "创建软著申请",
          requestBody: jsonRequest(applicationPayloadFields),
          responses: responses(applicationResponseSchema, "创建成功"),
        },
      },
      "/api/applications/{id}": {
        get: {
          tags: ["申请"],
          summary: "获取单个申请",
          requestParams: { path: applicationPath },
          responses: responses(applicationResponseSchema),
        },
        put: {
          tags: ["申请"],
          summary: "更新申请",
          requestParams: { path: applicationPath },
          requestBody: jsonRequest(applicationPayloadFields),
          responses: responses(applicationResponseSchema, "更新成功"),
        },
        delete: {
          tags: ["申请"],
          summary: "删除申请及关联文件",
          requestParams: { path: applicationPath },
          responses: responses(z.null(), "删除成功"),
        },
      },
      "/api/applications/{id}/materials": {
        get: {
          tags: ["材料"],
          summary: "获取申请材料清单和完成度",
          requestParams: { path: applicationPath },
          responses: responses(materialsResponseSchema),
        },
      },
      "/api/applications/{id}/materials/upload-url": {
        post: {
          tags: ["材料"],
          summary: "创建材料 signed upload 授权",
          requestParams: { path: applicationPath },
          requestBody: jsonRequest(materialUploadSchema),
          responses: responses(materialUploadAuthorizationSchema, "材料上传授权已创建"),
        },
      },
      "/api/applications/{id}/materials/complete": {
        post: {
          tags: ["材料"],
          summary: "确认材料上传完成",
          requestParams: { path: applicationPath },
          requestBody: jsonRequest(materialCompleteSchema),
          responses: responses(materialResponseSchema, "材料已上传"),
        },
      },
      "/api/applications/{id}/materials/{materialId}": {
        delete: {
          tags: ["材料"],
          summary: "删除申请材料",
          requestParams: { path: materialPath },
          responses: responses(z.null(), "材料已删除"),
        },
      },
      "/api/enrich": {
        post: {
          tags: ["生成"],
          summary: "使用模型配置补全申请信息",
          requestBody: jsonRequest(enrichRequestSchema),
          responses: responses(applicationResponseSchema, "AI 补全完成"),
        },
      },
      "/api/generate": {
        post: {
          tags: ["生成"],
          summary: "生成软著材料包",
          description: "返回 text/event-stream。完成事件的 data 为 GenerationComplete；失败事件包含 jobId 和 stage。",
          requestBody: jsonRequest(generateRequestSchema),
          responses: {
            ...standardErrorResponses,
            "200": {
              description: "SSE 生成进度流。",
              content: {
                "text/event-stream": {
                  schema: z.string().meta({
                    description: "每个事件以 data: JSON\\n\\n 格式返回。",
                  }),
                },
              },
            },
          },
        },
      },
      "/api/pdf": {
        post: {
          tags: ["辅助/内部"],
          summary: "内部 PDF 渲染服务",
          description: "仅供生成任务通过 CONVERTER_SHARED_SECRET 调用，返回 application/pdf，不对前端用户开放。",
          security: [{ internalPdfSecret: [] }],
          requestBody: jsonRequest(pdfRenderRequestSchema),
          responses: {
            "200": {
              description: "PDF 文件。",
              content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
            },
            ...standardErrorResponses,
          },
        },
      },
      "/api/generation-jobs": {
        get: {
          tags: ["生成"],
          summary: "获取申请最近一次生成任务",
          requestParams: {
            query: z.object({
              applicationId: applicationIdSchema.meta({ description: "申请 UUID。" }),
            }),
          },
          responses: responses(jobWithEventsSchema.nullable()),
        },
      },
      "/api/generation-jobs/{id}": {
        get: {
          tags: ["生成"],
          summary: "获取生成任务及事件",
          requestParams: { path: generationJobPath },
          responses: responses(jobWithEventsSchema),
        },
      },
      "/api/generation-records": {
        get: {
          tags: ["历史记录"],
          summary: "获取生成历史",
          responses: responses(z.array(generationRecordSchema)),
        },
      },
      "/api/generation-records/{id}/download/{kind}": {
        get: {
          tags: ["历史记录"],
          summary: "获取生成文件临时下载链接",
          requestParams: { path: generationDownloadPath },
          responses: responses(z.object({ url: z.string().url() })),
        },
      },
      "/api/llm-configs": {
        get: {
          tags: ["模型配置"],
          summary: "获取当前用户的模型配置",
          responses: responses(z.array(publicLlmConfigSchema)),
        },
        post: {
          tags: ["模型配置"],
          summary: "保存或更新模型配置",
          requestBody: jsonRequest(llmConfigWriteSchema),
          responses: responses(publicLlmConfigSchema, "模型配置已安全保存"),
        },
      },
      "/api/llm-configs/{id}": {
        delete: {
          tags: ["模型配置"],
          summary: "删除模型配置",
          requestParams: { path: llmConfigPath },
          responses: responses(z.null(), "模型配置已删除"),
        },
      },
      "/api/llm-configs/{id}/test": {
        post: {
          tags: ["模型配置"],
          summary: "测试已保存的模型配置",
          requestParams: { path: llmConfigPath },
          responses: responses(z.null(), "模型连接正常"),
        },
      },
      "/api/llm-test": {
        post: {
          tags: ["辅助/内部"],
          summary: "兼容接口：测试已保存的模型配置",
          description: "旧版兼容入口，新的调用方应使用 /api/llm-configs/{id}/test。",
          requestBody: jsonRequest(llmTestRequestSchema),
          responses: responses(z.null(), "模型连接正常"),
        },
      },
      "/api/source-upload": {
        post: {
          tags: ["辅助/内部"],
          summary: "创建源码压缩包上传授权",
          description: "获得授权后，客户端使用返回的 path 和 token 直接上传到 Supabase Storage。",
          requestBody: jsonRequest(sourceUploadSchema),
          responses: responses(sourceUploadAuthorizationSchema, "源码上传授权已创建"),
        },
      },
      "/api/source-feedback": {
        post: {
          tags: ["申请"],
          summary: "根据源码生成申请信息修正建议",
          description: "源码压缩包由客户端先直传到 Supabase Storage；本接口读取后生成建议并删除临时源码。建议必须由用户确认后再写回申请。",
          requestBody: jsonRequest(sourceFeedbackRequestSchema),
          responses: responses(sourceFeedbackResponseSchema, "源码反馈已生成"),
        },
      },
    },
  });
}

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
