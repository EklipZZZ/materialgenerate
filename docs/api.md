# API 接口说明

## 基本约定

API 基础路径为当前部署域名，所有路径均以 `/api` 开头。除健康检查外，接口都需要 Supabase Auth access token：

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

成功和普通错误使用统一响应包：

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": {}
}
```

错误时 `code` 通常与 HTTP 状态码一致，`data` 为 `null`。常见状态码：

（1）`400`：参数、UUID、文件名、扩展名或材料类型无效；

（2）`401`：缺少或无法验证 Bearer Token；

（3）`404`：资源不存在或不属于当前用户；

（4）`409`：资源状态冲突，例如申请已有运行中的生成任务；

（5）`500`：服务端、数据库、Storage 或上游 LLM 处理失败。

完整机器可读定义见 [openapi.json](./openapi.json)。修改接口时必须同步更新 OpenAPI 和本文档。

## 申请接口

### `GET /api/applications`

获取当前用户的申请列表。返回 `data` 为申请数组，申请中包含结构化 `copyright_holders`。

### `POST /api/applications`

创建申请。请求体中的申请字段和 `copyright_holders` 都是可选字段，具体字段以 OpenAPI 的 `ApplicationPayload` 为准。

`software_category`、`target_industry` 和 `programming_language` 在前端支持多个预设值及自定义补充；接口仍接收兼容历史数据的字符串，多个值以中文顿号（`、`）连接。

著作权人示例：

```json
{
  "software_full_name": "示例软件",
  "version": "V1.0",
  "development_method": "cooperative",
  "copyright_holders": [
    {
      "holder_type": "person",
      "name": "示例人员",
      "category": "自然人",
      "document_type": "居民身份证",
      "document_number": "示例证件号码",
      "nationality": "中国",
      "province": "示例省",
      "city": "示例市"
    }
  ]
}
```

证件号码示例仅用于说明字段格式，不应把示例值提交到真实申请。

### `GET /api/applications/{id}`

读取当前用户拥有的单个申请。

### `PUT /api/applications/{id}`

更新申请和著作权人列表。传入 `copyright_holders` 时，服务端会用请求列表替换该申请的著作权人列表，并重新计算排序。

### `DELETE /api/applications/{id}`

删除申请、数据库关联记录和服务端可识别的关联 Storage 对象。

## 材料接口

### `GET /api/applications/{id}/materials`

返回材料数组和完成度：

```json
{
  "materials": [],
  "summary": {
    "complete": false,
    "requiredCount": 6,
    "readyCount": 4
  }
}
```

合作开发时，`cooperation_agreement` 为必需材料；`signature_page` 默认显示 `awaiting_official`。

### `POST /api/applications/{id}/materials/upload-url`

请求材料上传授权：

```json
{
  "kind": "cooperation_agreement",
  "fileName": "cooperation-agreement.pdf",
  "contentType": "application/pdf",
  "size": 123456
}
```

服务端会校验申请归属、开发方式、材料类型、扩展名、文件大小和可选的 `holderId`。返回 `path`、`token` 和材料记录。

获得授权后，客户端使用 Supabase Storage 的 `uploadToSignedUrl(path, token, file)` 直传文件，不能把文件内容再次转发给本 API。

### `POST /api/applications/{id}/materials/complete`

直传成功后确认材料：

```json
{
  "materialId": "00000000-0000-0000-0000-000000000000",
  "size": 123456,
  "checksum": "optional-checksum"
}
```

服务端确认 Storage 对象存在且大小合规，然后将材料状态更新为 `uploaded`。

### `DELETE /api/applications/{id}/materials/{materialId}`

删除当前用户拥有的材料记录和关联 Storage 对象。

## 源码上传接口

### `POST /api/source-upload`

为 ZIP、TAR.GZ 或 TGZ 源码压缩包创建 signed upload 授权。单个源码压缩包上限为 100 MB。上传完成后，客户端将返回的 `path` 作为生成接口的 `sourceObjectKey`。

### `POST /api/source-feedback`

根据已上传的源码压缩包核对申请中的技术信息。请求体为：

```json
{
  "applicationId": "00000000-0000-0000-0000-000000000000",
  "llmConfigId": "00000000-0000-0000-0000-000000000000",
  "sourceObjectKey": "incoming/user-id/upload-id-source.zip",
  "sourceFileName": "source.zip"
}
```

服务端会确认申请、模型配置和源码对象属于当前用户，安全读取压缩包后返回源码文件数、统计行数以及建议列表。源码对象在本次请求结束时删除，不会自动覆盖申请。建议包含字段、原值、建议值和依据，前端由用户勾选后写回表单并另行调用申请更新接口。

源码反馈只允许涉及软件技术和功能字段，不涉及著作权人、证件、权利、申请人、联系人、联系方式或日期。源码统计行数由服务端计算，不接受模型猜测。

## AI 补全和材料生成

### `POST /api/enrich`

请求体：

```json
{
  "applicationId": "00000000-0000-0000-0000-000000000000",
  "llmConfigId": "00000000-0000-0000-0000-000000000000",
  "regenerateMainFunctions": true,
  "draft": {
    "software_full_name": "示例软件",
    "main_functions": ""
  }
}
```

`draft` 是页面当前尚未保存的技术字段草稿，空字符串也会被发送，用来避免服务端继续使用旧值。默认情况下接口只补全技术性空白字段，不覆盖已经填写的技术字段；当 `regenerateMainFunctions` 为 `true` 时，这是用户明确发起的重写操作，服务端会覆盖“软件的主要功能”，要求模型生成一段新的 500～1300 字符内容，必要时自动重试，仍不合格则返回 `422` 且不保存。著作权人、证件、权利说明、申请人和联系人不会由该接口覆盖或猜测。软件技术特点不超过 100 字符，环境/语言/开发目的/面向领域行业/软件分类不超过 50 字符。草稿阶段允许主要功能为空或短于 500 字符；正式材料生成仍会强制校验 500～1300 字符。

### `POST /api/generate`

请求体包含 `applicationId`、`llmConfigId`，以及可选的 `tableTemplate`、`skipAnalyze`、`sourceObjectKey` 和 `sourceFileName`。

此接口不是普通 JSON 响应，而是 `text/event-stream`。当 `skipAnalyze` 为 `true` 时，启动前会要求主要功能满足 500～1300 字符；事件格式为：

```text
data: {"step":"source_code","message":"正在生成源代码文档…","data":{}}

```

完成事件的 `step` 为 `complete`，其中包含任务 ID、记录 ID、DOCX/PDF 的临时下载地址、申请摘要和 PDF 预检提醒。失败事件的 `step` 为 `error`，包含任务 ID 和失败阶段。

任务状态也会写入 `generation_jobs` 和 `job_events`，因此页面可以在 SSE 中断后查询最近任务。

## 生成任务和历史

### `GET /api/generation-jobs?applicationId={applicationId}`

获取申请最近一次生成任务和事件。如果申请没有任务，`data` 为 `null`。

### `GET /api/generation-jobs/{id}`

获取指定生成任务及其事件。

### `GET /api/generation-records`

获取当前用户的生成历史摘要，不返回 API Key 或 Storage 私密字段。

### `GET /api/generation-records/{id}/download/{kind}`

获取 15 分钟有效的临时下载 URL。`kind` 可取：

（1）`source_code`；

（2）`source_code_pdf`；

（3）`user_manual`；

（4）`user_manual_pdf`；

（5）`application_summary_pdf`；

（6）`collection_form`。

## LLM 配置接口

### `GET /api/llm-configs`

获取当前用户的模型配置公开信息。响应只有供应商、模型、名称、末四位和时间字段。

### `POST /api/llm-configs`

保存或更新模型配置：

```json
{
  "id": "optional-existing-config-id",
  "name": "我的模型配置",
  "provider": "openai",
  "model": "allowed-model-name",
  "apiKey": "user-provided-key"
}
```

服务端收到明文 Key 后立即加密。完整 Key 不进入响应、日志、SSE 或 OpenAPI 示例。

### `DELETE /api/llm-configs/{id}`

删除当前用户的模型配置。

### `POST /api/llm-configs/{id}/test`

测试已保存的模型配置，不需要请求体。

### `POST /api/llm-test`

旧版兼容接口，请求体为 `{ "llmConfigId": "..." }`。新调用方应使用 `/api/llm-configs/{id}/test`。

## 辅助接口

### `GET /api/health`

公开健康检查，返回服务名称和 `ok: true`。

## 安全边界

接口只允许当前认证用户访问自己的申请、材料、任务、历史和模型配置。Supabase service role key 只能在服务端环境变量中使用，不能写入客户端代码或文档示例。

本 API 不代表官方版权登记网站接口，也不执行官方网页登录、签章、盖章或最终提交。
