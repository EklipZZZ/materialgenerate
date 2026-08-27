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
  ├─ generation_records
  └─ 私有 generated-documents Bucket

OpenAI / DeepSeek
  └─ 用户临时输入的 API Key
```

用户的 API Key 只保存在当前浏览器标签页，并在当前请求中转发给固定的 OpenAI 或 DeepSeek 端点。系统不保存 Key，不接受任意 Base URL。

## 本地开发

```bash
pnpm install
pnpm dev
```

本地 `.env` 至少需要复制 `.env.example` 并填写 Supabase 公共变量和服务端变量。若要在本地生成 DOCX，还需要安装 `requirements.txt` 中的 Python 依赖。

## 构建与检查

```bash
pnpm test
pnpm ts-check
pnpm lint
pnpm build
```

Vercel 使用 Next.js 默认输出目录，不使用 `out`，也不使用 Dockerfile。

## Supabase

按文件名顺序执行 `supabase/migrations/` 下的 3 个 SQL 文件，创建 Auth 用户关联的申请表、生成记录、索引和 RLS。Storage 中创建名为 `generated-documents` 的私有 Bucket。

## 部署

详细步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 安全边界

- 所有 API 通过 Supabase Bearer Token 解析当前用户。
- 服务端查询显式限制 `user_id`，不信任请求体中的用户 ID。
- 生成文件只保存 Supabase Object Key，下载时生成 15 分钟临时链接。
- API Key、完整提示词和上游错误正文不写入日志。
- 旧 Express 服务、平台专用 SDK、查询码和微信用户 ID 不参与构建。
