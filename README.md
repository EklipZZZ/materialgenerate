# 统一软著申报系统

本仓库同时包含 Cloudflare Pages 静态前端和唯一的 Railway Node 后端。

## 架构

```text
Cloudflare Pages（Next.js 静态前端）
  └─ Railway Node API
      ├─ 申请信息 CRUD
      ├─ Supabase JWT 校验与数据存取
      ├─ API Key AES-256-GCM 加密保存
      ├─ OpenAI / DeepSeek 固定端点调用
      ├─ AI 补全与 DOCX 生成
      └─ Supabase Storage 私有文件管理

Supabase：Auth + PostgreSQL + 私有 Storage
```

用户只会访问两个公开地址：Pages 前端和 Railway API。Supabase Storage 不需要自定义域名。

## 目录

- `src/`：Next.js 静态前端。
- `server/`：Express + TypeScript API。
- `assets/`：DOCX 转换脚本及模板。
- `supabase/migrations/`：新 Supabase 项目的数据库迁移。
- `DEPLOYMENT.md`：从零部署操作清单。

## 本地开发

```bash
pnpm install
pnpm dev
pnpm dev:server
```

Node 服务按 `.env.example` 配置本地 `.env`。不得提交 `.env`、服务端 Supabase 密钥或用户模型 Key。

## 构建与测试

```bash
pnpm build:pages
pnpm build:server
pnpm --dir server test
```

Pages 配置：

```text
Build command: pnpm build:pages
Build output directory: out
```

Railway 使用根目录 `Dockerfile`，健康检查为 `/health`。完整环境变量和部署顺序见 `DEPLOYMENT.md`。

## 安全边界

- Node 从 Supabase Access Token 解析用户身份，所有服务端数据查询均显式限定 `user_id`。
- API Key 只以 AES-256-GCM 密文保存，接口只返回末四位。
- 模型端点和模型名称在源码中白名单固定，不接受自定义 Base URL。
- OpenAI 和 DeepSeek 的错误响应正文不会写入日志或返回浏览器。
- API 有基础 IP 限流；同一用户同一时间只运行一个文档生成任务。
- Supabase Storage 只保存私有对象，下载时生成 15 分钟临时链接。
