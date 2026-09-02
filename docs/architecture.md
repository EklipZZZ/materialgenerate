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
          │    ├─ filing_jobs / filing_events
          │    ├─ filing_profiles
          │    ├─ generation_records
          │    └─ llm_configs
          │
          └─ Supabase Storage
               └─ 私有 generated-documents Bucket
```

Chrome MV3 扩展（用户本机）
  ├─ 网页桥接 content script（只接受当前应用 origin）
  ├─ Service Worker（标签页、分块文件传输和短期内存任务状态）
  └─ R11 content script（语义 DOM 定位、写入校验和人工暂停）

主应用部署目标仍是 Vercel + Supabase。业务 API 使用 Node.js runtime；LibreOffice 放在独立、可休眠的低权限 Docker 转换服务中，服务只处理短期 DOCX/PDF，不持有数据库或 Supabase 全局权限。

## 页面与 API 边界

页面只负责收集用户输入、展示任务进度和发起下载。服务端负责：

（1）从 Bearer Token 解析当前 Supabase 用户；

（2）使用 Zod 校验请求体和路径参数；

（3）显式按 `user_id` 查询和修改数据；

（4）解密当前用户的 LLM 配置；

（5）执行生成流程并持久化任务事件；

（6）生成短期 Storage 下载链接；

（7）读取和保存用户级官网填报默认资料。

服务端不信任请求体中的 `user_id`，也不向浏览器返回 Supabase service role key 或完整 LLM API Key。

## 认证和数据隔离

浏览器通过 Supabase Auth 获得 access token，并以以下形式调用 API：

```http
Authorization: Bearer <supabase-access-token>
```

Route Handler 使用 Supabase 服务端客户端验证 token。数据库层对用户数据表启用 RLS，策略同时检查认证用户的 `auth.uid()` 和行的 `user_id`。

当前服务端查询还显式加入用户条件，这是 RLS 之外的第二层隔离。材料下载链接有效期为 15 分钟，Storage Bucket 保持私有。

## 官方网页填报边界

填报任务由 `filing_jobs` / `filing_events` 持久化。网页应用在创建或恢复任务时重新读取申请、材料和用户级官网填报资料，并签发短期下载地址；任务表只保存申请更新时间、材料 ID/校验值和状态，不保存签名 URL、密码或完整表单快照。

Chrome 扩展通过页面 `postMessage` 与网页应用通信，再由 Service Worker 打开官方 R11 页面并把脱敏步骤事件转回应用。扩展只允许当前配置的应用 origin、版权中心官网和 Supabase Storage origin；不申请 Cookie、历史记录、密码读取、Native Messaging 或远程脚本权限。申请字段和材料在发送给扩展前必须经过网页中的明确确认。

R11 适配器只使用可见标签、ARIA、字段名称和附近语义容器定位控件，并在写入后读取校验。字段缺失、定位不唯一、文件控件拒绝注入或页面结构变化都会安全暂停。登录、验证码、短信/实名验证、签章页的下载打印签章和最终提交永远停留在人工作业。

## 申请和著作权人流程

软件和权利信息存储在 `applications`，结构化著作权人存储在 `copyright_holders`，官网后续弹窗使用的地址、邮编、联系人和电话单独存储在每个用户一条的 `filing_profiles`。创建或更新申请时，API 先校验申请字段，再按请求中的 `copyright_holders` 替换该申请的著作权人列表，并按数组顺序写入 `sort_order`。

旧版 `company_name` 和 `credit_code` 仍保留在 `applications`。当请求包含组织著作权人时，服务端会在旧字段为空时同步写入首个组织著作权人的名称和证件号码。

## 材料流程

材料有两类来源：

（1）服务端生成：源代码 DOCX/PDF、用户手册 DOCX/PDF 和采集表 Markdown；

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

材料列表接口会确保条件材料槽位存在，再返回每种材料的最新记录和完成度摘要。摘要分别统计普通材料完整度和“自动填报前置材料”（源代码 PDF、用户手册 PDF及开发方式要求的证明）；申请确认签章页属于官方后续材料，不阻塞第一次自动填写。

## 生成流程

```text
POST /api/generate
  → 创建 generation_jobs（queued）
  → 更新为 running
  → 写入 job_events 并向浏览器发送 SSE
  → 读取当前已保存申请和申请级源码包（若存在且核对版本有效）
  → LLM 生成 Markdown 内容
  → 由规范化内容生成 DOCX
  → LibreOffice 从该 DOCX 导出 PDF
  → 上传生成文件到私有 Bucket
  → 创建 generation_records 和 application_materials
  → 更新申请、任务为 completed
```

生成接口目前仍是前台 SSE 长请求，不是真正的后台队列。关闭浏览器可能中断执行，但已经写入数据库的失败状态、任务事件和已经完成的文件记录不会依赖内存 Set 保存。长篇用户手册章节串行调用模型，并在同批请求失败时取消剩余调用；DeepSeek 文档生成默认关闭思考模式。由于 Vercel Hobby 计划的 Serverless Function 上限为 300 秒，生成函数配置为 300 秒，并在 270 秒触发服务端软超时，以便在平台硬终止前写入失败状态和释放任务锁。DOCX 生成完成后，主生成进程串行请求独立 LibreOffice 服务转换源代码和用户手册两个 PDF；转换服务内部限制 LibreOffice 并发，使用独立临时目录并在请求结束后删除文件，免费容器冷启动网关错误使用受总超时约束的短指数退避重试。用户手册 DOCX 会清除旧模板中的浮动 PAGE 内容控件，并重建为与源代码文档一致的单段页眉，以保证 LibreOffice 导出的标题和动态页码处于同一行。

发生异常时，任务进入 `failed` 或 `cancelled`，记录失败阶段，删除本次生成的临时产物，并将申请恢复到可重试状态。申请级源码压缩包始终保留供再次核对、重试和重新生成使用。模型请求尚未返回正文时发生网络、超时、429 或 5xx 错误，会在总时限内自动重试最多两次。

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

## 扩展任务流程

```text
网页确认并创建 filing_job
  → 扩展打开 R11
  → 用户手动登录/验证码/实名
  → 扩展填写申请表
  → 人工复核后点击继续
  → 扩展分块下载并上传 PDF/协议
  → 官方生成签章页，用户打印签章并回传网页应用
  → 用户点击继续，扩展上传签章页
  → 自动化完成，停在最终提交前
```

扩展测试使用本地模拟页面和 Playwright；真实官网只进行人工登录后的非提交冒烟测试。
