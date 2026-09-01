# 软著申报助手

这是一个基于 Next.js、Vercel 和 Supabase 的软件著作权材料生成应用。

## 架构

```text
Vercel
  ├─ Next.js 页面
  ├─ Next.js Node.js API Functions
  └─ Python DOCX conversion function

Supabase
  ├─ Email Auth
  ├─ applications
  ├─ copyright_holders
  ├─ application_materials
  ├─ generation_jobs / job_events
  ├─ generation_records
  └─ 私有 generated-documents Bucket

OpenAI / DeepSeek
  └─ 用户配置的 API Key（服务端 AES-256-GCM 加密）
```

申请编辑页支持源码反馈：上传源码压缩包后，服务端统计源码行数并给出技术字段修正建议；建议需要用户勾选确认，才会写回申请。软著表单中的环境/语言/开发目的/面向领域行业/软件分类不超过 50 字符，软件技术特点不超过 100 字符，软件的主要功能为 500～1300 字符。

用户在设置页保存模型配置时，API Key 会立即在服务端使用 AES-256-GCM 加密写入 `llm_configs`。浏览器只保留配置 ID、服务商、模型和末四位；生成或 AI 补全时服务端按当前账户解密使用。系统不接受任意 Base URL。

## 本地开发

```bash
pnpm install
pnpm dev
```

本地 `.env` 至少需要复制 `.env.example` 并填写 Supabase 公共变量和服务端变量。若要在本地生成 DOCX，还需要安装 `requirements.txt` 中的 Python 依赖。

## 构建与检查

```bash
pnpm api:check
pnpm test
pnpm ts-check
pnpm lint
pnpm build
```

开发文档入口见 [docs/README.md](./docs/README.md)。接口的人类可读说明见 [docs/api.md](./docs/api.md)，机器可读契约见 [docs/openapi.json](./docs/openapi.json)。接口 schema 统一维护在 `src/server/api-contracts.ts`，修改 API 后先运行 `pnpm api:generate` 更新 OpenAPI，再运行 `pnpm api:check`。

Vercel 使用 Next.js 默认输出目录，不使用 `out`，也不使用 Dockerfile。

## Supabase

按文件名顺序执行 `supabase/migrations/` 下的 SQL 文件，创建 Auth 用户关联的申请、著作权人、材料、持久化任务、生成记录、源码包、索引和 RLS。Storage 中创建名为 `generated-documents` 的私有 Bucket。DOCX 由现有 Python 模板生成，正式 PDF 由 `services/docx-pdf-converter` 中的 LibreOffice 隔离服务从 DOCX 转换，避免两套排版引擎造成页眉、页码、行号和中文字体错乱。

## 部署

详细步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 安全边界

- 所有 API 通过 Supabase Bearer Token 解析当前用户。
- 服务端查询显式限制 `user_id`，不信任请求体中的用户 ID。
- 生成文件只保存 Supabase Object Key，下载时生成 15 分钟临时链接。
- 源代码、用户手册同时生成 DOCX/PDF；合作协议由用户上传，申请确认签章页由官方系统生成后上传。
- `generation_jobs` 和 `job_events` 持久化任务状态，但生成仍是前台 SSE 请求，不承诺关闭网页后继续执行。
- API Key、完整提示词和上游错误正文不写入日志。
- 旧 Express 服务、平台专用 SDK、查询码和微信用户 ID 不参与构建。
