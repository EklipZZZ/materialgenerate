# Vercel + Supabase 部署清单

## 1. Supabase

如果 3 个迁移文件已经执行过，不要重复执行。它们是幂等的，但正常部署只需执行一次：

```text
supabase/migrations/20260825000100_create_softreg_tables.sql
supabase/migrations/20260825000200_add_softreg_indexes.sql
supabase/migrations/20260825000300_enable_softreg_rls.sql
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
LLM_REQUEST_TIMEOUT_MS=120000
```

可以在 PowerShell 生成转换服务密钥：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

不要把用户的 OpenAI/DeepSeek Key 配置到 Vercel。用户会在网页中临时输入自己的 Key。

## 5. Supabase Auth URL

部署后，在 Authentication → URL Configuration 设置：

```text
Site URL:
https://<your-project>.vercel.app

Redirect URLs:
https://<your-project>.vercel.app/auth/callback/
https://<your-project>.vercel.app/auth/reset-password/
```

正式域名变更后，同时更新 Site URL 和 Redirect URLs。

## 6. 首次验收

按以下顺序测试：

1. 注册、邮箱验证、登录和退出。
2. 忘记密码和重置密码。
3. 新建、修改、删除申请。
4. 输入 API Key 并测试模型连接。
5. AI 补全申请信息。
6. 上传大于 4.5 MB 的 ZIP/TAR.GZ 源码压缩包。
7. 生成源码文档、用户手册和采集表。
8. 查看历史记录并重新获取下载链接。
9. 用第二个账号确认无法读取第一个账号的数据。
10. 检查 Vercel 日志，确认没有 API Key、提示词和上游错误正文。

## 7. 运行边界

- 生成接口是 SSE 长请求，单次最大执行时间按 Vercel Function 配置限制。
- 源码压缩包先直传 Supabase，再由 Vercel 读取，避免 Function 请求体限制。
- 生成文件保存在 Supabase 私有 Bucket，下载 URL 只有 15 分钟有效期。
- `llm_configs` 表保留但不再使用，用户 API Key 不入库。
- 本项目不再需要 Railway、Render、Cloudflare Pages 或 Cloudflare Worker。
