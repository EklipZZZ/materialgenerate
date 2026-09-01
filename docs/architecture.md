# 系统架构

## 总体结构

```text
浏览器
  ├─ Supabase Auth 获取 access token
  ├─ Next.js 页面和客户端 API 封装
  └─ 文件通过 signed upload 直传 Supabase Storage
          │
          ▼
Next.js App Router
  ├─ Node.js Route Handlers
  ├─ Zod 请求校验
  ├─ LLM 调用和生成任务状态持久化
  ├─ DOCX 生成/转换调用
  └─ 隔离 LibreOffice 服务将 DOCX 转为 PDF
          │
          ├─ Supabase Database
          │    ├─ applications
          │    ├─ copyright_holders
          │    ├─ application_materials
          │    ├─ application_source_archives
          │    ├─ generation_jobs / job_events
          │    ├─ generation_records
          │    └─ llm_configs
          │
          └─ Supabase Storage
               └─ 私有 generated-documents Bucket
```

主应用部署目标仍是 Vercel + Supabase。业务 API 使用 Node.js runtime；LibreOffice 放在独立、可休眠的低权限 Docker 转换服务中，服务只处理短期 DOCX/PDF，不持有数据库或 Supabase 全局权限。

## 页面与 API 边界

页面只负责收集用户输入、展示任务进度和发起下载。服务端负责：

（1）从 Bearer Token 解析当前 Supabase 用户；

（2）使用 Zod 校验请求体和路径参数；

（3）显式按 `user_id` 查询和修改数据；

（4）解密当前用户的 LLM 配置；

（5）执行生成流程并持久化任务事件；

（6）生成短期 Storage 下载链接。

服务端不信任请求体中的 `user_id`，也不向浏览器返回 Supabase service role key 或完整 LLM API Key。

## 认证和数据隔离

浏览器通过 Supabase Auth 获得 access token，并以以下形式调用 API：

```http
Authorization: Bearer <supabase-access-token>
```

Route Handler 使用 Supabase 服务端客户端验证 token。数据库层对用户数据表启用 RLS，策略同时检查认证用户的 `auth.uid()` 和行的 `user_id`。

当前服务端查询还显式加入用户条件，这是 RLS 之外的第二层隔离。材料下载链接有效期为 15 分钟，Storage Bucket 保持私有。

## 申请和著作权人流程

申请主体存储在 `applications`，结构化著作权人存储在 `copyright_holders`。创建或更新申请时，API 先校验申请字段，再按请求中的 `copyright_holders` 替换该申请的著作权人列表，并按数组顺序写入 `sort_order`。

旧版 `company_name` 和 `credit_code` 仍保留在 `applications`。当请求包含组织著作权人时，服务端会在旧字段为空时同步写入首个组织著作权人的名称和证件号码。

## 材料流程

材料有两类来源：

（1）服务端生成：源代码 DOCX/PDF、用户手册 DOCX/PDF 和申请信息摘要 PDF；

（2）用户或官方流程上传：合作开发协议、签章页以及预留的身份证明等材料。

上传材料使用两阶段流程：

```text
客户端请求 upload-url
  → 服务端校验申请归属、材料类型、扩展名和大小
  → 返回 Supabase signed upload path/token
  → 客户端直传私有 Bucket
  → 客户端调用 complete
  → 服务端校验对象大小并将状态更新为 uploaded
```

材料列表接口会确保条件材料槽位存在，再返回每种材料的最新记录和完成度摘要。

## 生成流程

```text
POST /api/generate
  → 创建 generation_jobs（queued）
  → 更新为 running
  → 写入 job_events 并向浏览器发送 SSE
  → 按 sourceMode 明确读取持久化源码包或生成源码
  → LLM 生成 Markdown 内容
  → 由规范化内容生成 DOCX
  → LibreOffice 从该 DOCX 导出 PDF
  → 上传生成文件到私有 Bucket
  → 创建 generation_records 和 application_materials
  → 更新申请、任务为 completed
```

生成接口目前仍是前台 SSE 长请求，不是真正的后台队列。关闭浏览器可能中断执行，但已经写入数据库的失败状态、任务事件和已经完成的文件记录不会依赖内存 Set 保存。长篇用户手册章节串行调用模型，并在同批请求失败时取消剩余调用；DeepSeek 文档生成默认关闭思考模式。由于 Vercel Hobby 计划的 Serverless Function 上限为 300 秒，生成函数配置为 300 秒，并在 270 秒触发服务端软超时，以便在平台硬终止前写入失败状态和释放任务锁。DOCX 生成完成后，主生成进程并行请求独立 LibreOffice 服务转换三个 PDF；转换服务内部限制 LibreOffice 并发，使用独立临时目录并在请求结束后删除文件，冷启动网关错误自动重试一次。

发生异常时，任务进入 `failed` 或 `cancelled`，记录失败阶段，删除本次生成的临时产物，并将申请恢复到可重试状态。申请级源码压缩包会保留供重试使用；使用源码成功生成后再清理。模型请求尚未返回正文时发生网络、超时、429 或 5xx 错误，会在总时限内自动重试最多两次。

如果 Vercel 请求在来不及执行清理逻辑时被中断，任务查询和下一次创建任务都会检查同一申请的 `queued/running` 任务。只有超过 `GENERATION_JOB_STALE_MS`（默认 6 分钟，且服务端最多按 6 分钟回收）未更新的任务才会被标记为 `failed` 并释放任务锁，正常运行中的任务仍然返回冲突提示。

## 文档生成

LLM 负责产生规范化 Markdown 内容。DOCX 是正式排版的唯一来源，PDF 必须从生成后的 DOCX 转换，避免两个格式的正文和版式分叉：

```text
规范化 Markdown
  → DOCX 生成/模板排版
  → LibreOffice Writer PDF 导出
```

LibreOffice 直接读取已验证的 DOCX，从而保留 Word 文档中的页眉、页脚、页码、源码行号、分页和字体映射。主应用校验 PDF 文件头、文件尾、大小和页数，并继续给出材料行数与页数提醒。生成产物使用 ASCII Storage 对象键，中文软件名只作为下载显示名称保存。旧 PDFKit 路由仅保留兼容诊断，不再进入正式材料生成链路。

## LLM 配置

用户在设置页输入明文 API Key。服务端使用 AES-256-GCM 加密后保存到 `llm_configs`，只向前端返回配置 ID、供应商、模型和末四位。生成和测试时，服务端按当前用户和配置 ID 查询并临时解密。

`sessionStorage` 只作为浏览器便利缓存，不是配置的真实来源。真实配置来源是数据库。

## 未来浏览器自动化边界

官方网页自动填报不属于当前架构实现。未来接入时应将其视为独立的浏览器执行层，输入来自本系统的申请和材料 API，输出是步骤状态、人工确认点和上传结果。登录、验证码、签名、盖章和最终提交必须保留明确的人工确认边界，不能把当前材料生成 API 误认为官方提交 API。
