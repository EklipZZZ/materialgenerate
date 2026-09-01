# Vercel + Supabase 部署清单

## 1. Supabase

如果前 3 个迁移文件已经执行过，只需执行新增的第 4 个迁移。迁移使用 `if not exists`、约束和幂等回填逻辑，正常部署按文件名顺序执行一次即可：

```text
supabase/migrations/20260825000100_create_softreg_tables.sql
supabase/migrations/20260825000200_add_softreg_indexes.sql
supabase/migrations/20260825000300_enable_softreg_rls.sql
supabase/migrations/20260829000400_add_copyright_workflow.sql
```

在 Supabase Storage 创建私有 Bucket：

```text
generated-documents
```

在 Project Settings → API 记录：

```text
Project URL
Publishable key
Secret/service role key
```

Publishable key 可以进入 Vercel 的公开变量；Secret/service role key 只能进入 Vercel 服务端变量。

## 2. GitHub

将当前 `vercel-byok` 分支提交并推送到 `materialgenerate` GitHub 仓库。不要提交：

```text
.env
.env.local
SUPABASE_SERVICE_ROLE_KEY
CONVERTER_SHARED_SECRET
任何用户 API Key
```

## 3. Vercel 项目

在 Vercel Import Git Repository，选择 `materialgenerate`：

```text
Framework Preset: Next.js
Root Directory: 仓库根目录
Build Command: pnpm build
Install Command: pnpm install --frozen-lockfile
Output Directory: 留空，使用默认 .next
```

不要配置 `out`，不要使用 Dockerfile。

## 4. Vercel 环境变量

公开变量：

```text
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase Publishable key>
```

服务端变量：

```text
SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase Secret/service role key>
SUPABASE_STORAGE_BUCKET=generated-documents
CONVERTER_SHARED_SECRET=<随机生成的高强度字符串>
DOCX_PDF_CONVERTER_URL=<LibreOffice 转换服务 HTTPS 地址>
LLM_CONFIG_ENCRYPTION_KEY=<32 字节密钥的 base64 或 64 位 hex>
LLM_REQUEST_TIMEOUT_MS=120000
```

可以在 PowerShell 生成转换服务密钥：

```powershell
$bytes = [byte[]]::new(32)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

同样的方法也可以生成 `LLM_CONFIG_ENCRYPTION_KEY`。两者应使用不同的随机值；加密根密钥上线后必须长期保管，不能随意更换。

## 5. LibreOffice PDF 转换服务

将 `services/docx-pdf-converter` 作为独立 Docker 服务部署。免费平台可使用 SnapDeploy 或 Kubeletto，但必须先用长篇源码文档验证 512 MB 内存是否足够。

转换服务只配置 `CONVERTER_SHARED_SECRET`，且必须与 Vercel 使用相同随机密钥。不要向转换服务配置 `SUPABASE_SERVICE_ROLE_KEY`、数据库连接串、模型 API Key 或 `LLM_CONFIG_ENCRYPTION_KEY`。部署后先验证 `GET /health`，再把服务根地址写入 Vercel 的 `DOCX_PDF_CONVERTER_URL`。免费实例会休眠，生成接口会对冷启动网关错误重试一次。

`LLM_CONFIG_ENCRYPTION_KEY` 是已有用户 API Key 的解密根密钥，首次上线后必须长期保管，不能随意更换；如需轮换，应先设计密钥迁移。不要把用户的 OpenAI/DeepSeek Key 配置到 Vercel，用户在网页设置中保存自己的 Key。

## 6. Supabase Auth URL

部署后，在 Authentication → URL Configuration 设置：

```text
Site URL:
https://<your-project>.vercel.app

Redirect URLs:
https://<your-project>.vercel.app/auth/callback/
https://<your-project>.vercel.app/auth/reset-password/
```

正式域名变更后，同时更新 Site URL 和 Redirect URLs。

## 7. 文档与接口契约检查

部署前运行：

```bash
pnpm api:check
pnpm test
pnpm ts-check
pnpm lint
pnpm build
```

开发文档入口为 [docs/README.md](./docs/README.md)。接口变更必须同步更新共享 Zod schema、`src/server/openapi.ts`、[docs/api.md](./docs/api.md) 和 [docs/openapi.json](./docs/openapi.json)。

## 8. 首次验收

按以下顺序测试：

1. 注册、邮箱验证、登录和退出。
2. 忘记密码和重置密码。
3. 新建、修改、删除申请。
4. 输入 API Key 并测试模型连接。
5. AI 补全申请信息。
6. 上传大于 4.5 MB 的 ZIP/TAR.GZ 源码压缩包。
7. 生成源码文档、用户手册、申请信息摘要的 DOCX/PDF 产物。
8. 上传、替换、删除合作开发协议；确认非合作开发不会要求该文件。
9. 确认申请确认签章页显示“等待官方系统生成”，上传 PDF 后变为已上传。
10. 刷新页面、重新登录后确认仍能使用已保存的 AI 配置。
11. 查看历史记录并重新获取下载链接。
12. 用第二个账号确认无法读取第一个账号的申请、配置和材料。
13. 检查 Vercel 日志，确认没有 API Key、提示词和上游错误正文。

## 8. 运行边界

- 生成接口是 SSE 长请求，单次最大执行时间按 Vercel Function 配置限制。
- 源码压缩包先直传 Supabase，再由 Vercel 读取，避免 Function 请求体限制。
- 生成文件保存在 Supabase 私有 Bucket，下载 URL 只有 15 分钟有效期。
- `llm_configs` 表保存 AES-256-GCM 密文、IV、认证标签、密钥版本和末四位，不返回完整 API Key。
- 生成任务状态和材料状态写入 Supabase；前台 SSE 中断后可看到失败记录并重新生成，但本阶段没有后台队列。
- 本项目不再需要 Railway、Render、Cloudflare Pages 或 Cloudflare Worker。
