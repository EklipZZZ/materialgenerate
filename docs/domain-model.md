# 领域模型与状态

## 核心实体

### applications

一条软件著作权申请。它保存软件信息、权利说明和著作权人关联，也保留历史兼容字段；官网填报时使用的默认地址和联系人不再从这条申请读取。

关键关系：

（1）一个用户可以有多个申请；

（2）一个申请可以有多个 `copyright_holders`；

（3）一个申请可以有多个生成任务和生成记录；

（4）一个申请可以有多个材料记录，但接口按材料类型返回最新记录；

（5）申请删除时，数据库关联记录级联删除，关联 Storage 对象由服务端清理。

### copyright_holders

申请的结构化著作权人列表。`holder_type` 只有 `person` 和 `organization` 两种值。

字段含义：

| 字段 | 含义 |
| --- | --- |
| `holder_type` | 自然人或企业/单位 |
| `name` | 姓名或单位名称 |
| `category` | 证件主体类别或单位类别 |
| `document_type` | 身份证、统一社会信用代码证书等证件类型 |
| `document_number` | 证件号码或统一社会信用代码 |
| `nationality` | 国籍 |
| `province` / `city` | 所在省份和城市 |
| `birth_or_established_date` | 仅自然人出生日期；数据库旧列名称保留兼容，企业/单位不再展示或采集该字段 |
| `sort_order` | 申请中的著作权人顺序 |

系统不从开发参与者自动推断著作权人。用户必须明确录入每个著作权人。

著作权人表不再使用园区字段。历史数据库中的 `park` 列可以保留，但读取、编辑和新写入流程都会忽略它。

申请表中的技术字段有固定长度边界：环境、编程语言、开发目的、面向领域行业和软件分类不超过 50 字符；软件技术特点不超过 100 字符；软件的主要功能为 500～1300 字符。申请人地址、邮编、联系人和电话由用户级 `filing_profiles` 管理，不属于申请编辑表单。

### application_materials

申请相关文件和待办材料的统一记录。

材料类型：

（1）`source_code_docx`、`source_code_pdf`；

（2）`user_manual_docx`、`user_manual_pdf`；

（3）`application_summary_pdf`（历史兼容类型，不再新生成或展示）；

（4）`cooperation_agreement`；

（5）`signature_page`；

（6）`holder_identity_proof`、`commission_agreement`、`task_order` 预留类型。

材料状态：

| 状态 | 含义 |
| --- | --- |
| `missing` | 必需材料尚未提供 |
| `generated` | 系统已经生成 |
| `uploaded` | 用户已经上传并完成确认 |
| `awaiting_official` | 需要先从官方系统取得 |
| `awaiting_user` | 等待用户上传或补充 |
| `invalid` | 文件需要重新处理 |

材料来源为 `generated`、`uploaded` 或 `official`。文件实际内容存放在私有 Storage Bucket，数据库保存 object key 和文件元数据。

### generation_jobs 与 job_events

`generation_jobs` 表示一次材料生成尝试，`job_events` 表示其阶段进度。

任务状态：

```text
queued → running → completed
                 ├→ failed
                 └→ cancelled
```

同一申请通过部分唯一索引限制只能有一个 `queued` 或 `running` 任务。失败和取消的任务不会阻塞重新生成。

典型阶段包括 `queued`、`init`、`analyze`、`source_code`、`manual`、`convert`、`upload` 和 `complete`。阶段事件同时写入数据库和 SSE 流。

### filing_jobs 与 filing_events

`filing_jobs` 表示一次 Chrome 扩展辅助 R11 填报任务，`filing_events` 保存脱敏步骤事件。填报任务状态为：

```text
created → waiting_extension → opening_portal → waiting_login → filling
                                                        ↓
                         waiting_review → uploading → waiting_user → completed
```

`failed` 和 `cancelled` 是终态，允许重新建立任务。活动状态按申请使用部分唯一索引限制为一个。任务只保存申请更新时间、材料 ID/类型/校验值、扩展版本、步骤和错误码，不保存签名下载 URL、密码或完整表单快照。短期材料下载地址只在创建和恢复响应中返回。

扩展可在 `waiting_login`、`waiting_review` 和 `waiting_user` 暂停。`signature_page_required` 表示用户需要从官方系统取得签章页、打印签章后上传回本系统；`completed` 仅表示扩展完成填写和上传，不代表官方登记已经提交。

### application_source_archives

保存当前申请可用于材料生成的源码压缩包。每个申请最多一条记录，Storage 对象键使用 ASCII UUID，数据库单独保留用户看到的原始文件名、类型和大小。任务失败、页面刷新或材料生成成功后，记录和对象都继续保留，供再次核对和重新生成使用。上传或替换会将 `review_status` 重置为 `pending`；申请内容变更也会使旧核对版本失效。所有查询、替换和删除同时校验 `application_id` 与 `user_id`。

源码核对状态为 `pending`、`confirmed` 或 `skipped`，并记录核对时的申请更新时间、源码更新时间和核对时间。材料生成只有在当前源码版本已确认或明确跳过核对时才会使用该源码。

### filing_profiles

每个用户一条的官网填报默认资料，保存申请人地址、邮政编码、联系人和联系电话。允许保存不完整内容；创建填报任务前服务端必须检查四项均非空。该表不保存电子邮箱，也不自动从旧申请迁移联系方式。

### generation_records

一次成功或失败的生成结果记录。它关联申请、任务、供应商和模型，并保存生成文件的 Storage object key。历史页面只返回非敏感的摘要字段，实际下载通过短期签名 URL 完成。

### llm_configs

当前用户保存的模型配置。表中保存 AES-256-GCM 的 `ciphertext`、`iv`、`auth_tag`、`key_version` 和 `key_last4`，不保存明文 API Key。

前端只获取：

（1）配置 ID；

（2）名称；

（3）供应商；

（4）模型；

（5）API Key 末四位；

（6）创建和更新时间。

软件分类、面向领域/行业和编程语言在界面上是“预设多选 + 自定义补充”，数据库继续使用兼容的文本字段，多个值以中文顿号连接。AI 补全默认只处理技术性字段并填充空白值，不覆盖用户已经填写的内容。用户明确触发主要功能生成时，客户端会提交当前技术字段草稿，服务端只对“软件的主要功能”执行受控重写，并要求结果为 500～1300 字符；不合格结果不会写回。源码反馈是独立的建议流程：源码行数由服务端统计，其他建议必须由用户勾选后才写回申请草稿。材料页在前置 PDF 和条件证明齐全、官网默认资料完整后才允许创建 Chrome 填报任务。

## 申请状态

`applications.status` 的当前值：

```text
draft → enriched → generating → completed
  ↑         │           │
  └─────────┴───────────┘（失败后回到可编辑状态）
```

`archived` 为历史保留状态。生成失败时任务本身记录 `failed`，申请恢复为 `draft`，用户可以修改材料或模型配置后重试。

## 兼容字段

旧字段 `company_name` 和 `credit_code` 不删除，原因是历史记录和旧页面仍可能读取它们。

兼容规则：

（1）旧申请只有公司字段时，迁移会创建一个 `organization` 著作权人；

（2）新申请使用 `copyright_holders` 作为主数据；

（3）请求包含组织著作权人时，若旧字段为空，则同步写入第一个组织主体；

（4）读取申请时同时返回旧字段和结构化著作权人。

## 数据隔离

所有业务表都有 `user_id`，并对公开 schema 中的用户数据表启用 RLS。查询和更新必须同时满足：

```text
当前认证用户 = 行的 user_id
```

更新 policy 同时使用 `USING` 和 `WITH CHECK`，避免通过更新把记录转移给其他用户。服务端也显式加入 `user_id` 条件。

## 数据库来源

数据库结构的真实来源是 `supabase/migrations/` 中按时间顺序执行的 SQL。新增字段、表、索引、约束或 RLS policy 时必须通过 migration 记录，并更新本文档的实体说明。
