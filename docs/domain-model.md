# 领域模型与状态

## 核心实体

### applications

一条软件著作权申请。它保存软件信息、权利说明、申请人和联系人信息，也保留历史兼容字段。

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
| `park` | 园区等补充区域，可选 |
| `birth_or_established_date` | 自然人出生日期或单位成立日期 |
| `sort_order` | 申请中的著作权人顺序 |

系统不从开发参与者自动推断著作权人。用户必须明确录入每个著作权人。

### application_materials

申请相关文件和待办材料的统一记录。

材料类型：

（1）`source_code_docx`、`source_code_pdf`；

（2）`user_manual_docx`、`user_manual_pdf`；

（3）`application_summary_pdf`；

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
