# 两个公开地址的部署操作清单

最终只有两个用户可见地址：

```text
前端：https://<pages-project>.pages.dev
后端：https://<render-service>.onrender.com
```

Supabase Storage 是托管能力，不需要购买或配置额外域名。按以下顺序操作可以避开 Pages 地址与 CORS 配置之间的循环依赖。

## 0. 上线前安全处理

1. 本次部署只使用新 Supabase 项目和新建的 `generated-documents` Storage Bucket。
2. 确认 `.env`、`.env.local`、私钥和凭据文件没有进入本次提交。
3. 只将本仓库 `materialgenerate` 推送到准备用于部署的 GitHub 仓库。
4. `archive/` 中的旧仓库不参与部署；如果旧 Supabase 项目仍存在并仍接受旧服务端 Key，再单独撤销旧 Key。

## 1. 创建 Supabase 项目

1. 在 Supabase 创建一个新项目并妥善保存数据库密码。
2. 打开 SQL Editor，按文件名顺序分别执行：
   - `supabase/migrations/20260825000100_create_softreg_tables.sql`
   - `supabase/migrations/20260825000200_add_softreg_indexes.sql`
   - `supabase/migrations/20260825000300_enable_softreg_rls.sql`
3. 在 Authentication → Providers 中启用 Email/Password，并开启邮箱确认。
4. 在 Project Settings → API 中记录：
   - Project URL
   - Publishable key（可公开，仅给 Pages）
   - Secret key/service role key（高权限，仅给 Render）
5. 暂时不要填写最终 Redirect URL；获得 Pages 地址后在第 6 步补齐。

正式对外使用前应在 Authentication → SMTP Settings 配置自有 SMTP。Supabase 默认邮件服务适合测试，不适合作为正式邮件通道。

## 2. 创建 Supabase Storage 私有桶

1. 在 Supabase Dashboard → Storage → New bucket 创建桶，名称使用 `generated-documents`。
2. 关闭 `Public bucket`，保持私有。
3. Render 使用 Supabase 服务端密钥访问文件，并为历史下载生成 15 分钟临时 URL。
4. 不需要创建 Cloudflare 对象存储、对象存储 API Token 或对象存储自定义域名。

浏览器不直接访问 Supabase Storage API。上传和下载均由 Render 后端完成。

## 3. 部署唯一的 Render Free Node 后端

1. 在 Render 点击 `New` → `Web Service`，连接 GitHub 并选择 `materialgenerate`。
2. Root Directory 保持为空或填写 `/`。
3. Language 选择 `Docker`，Dockerfile Path 填 `Dockerfile`。
4. Instance Type 选择 `Free`。
5. 添加以下变量：

```text
SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase Secret/service role key>
SUPABASE_STORAGE_BUCKET=generated-documents
LLM_KEY_ENCRYPTION_SECRET=<固定的高强度随机值>
ALLOWED_ORIGINS=https://placeholder.invalid
PYTHON_BIN=python3
LLM_REQUEST_TIMEOUT_MS=180000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AI_RATE_LIMIT_MAX=30
```

不要手动设置 `PORT`，Render 会自动注入 `10000`。可在 PowerShell 生成加密密钥：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

`LLM_KEY_ENCRYPTION_SECRET` 上线后必须长期备份；更改它会导致已保存的用户 API Key 无法解密。

6. 部署成功后记录 Render Public URL。
7. 访问 `https://<render-domain>/health`，应返回 `{"ok":true}`。
8. 记录完整 Render URL，不要在末尾添加 `/`。

## 4. 部署 Cloudflare Pages 前端

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git。
2. 选择同一个 `materialgenerate` GitHub 仓库。
3. 设置：

```text
Framework preset: Next.js (Static HTML Export)
Root directory: /
Build command: pnpm build:pages
Build output directory: out
Node version: 22
```

4. 添加生产环境变量：

```text
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase Publishable key>
NEXT_PUBLIC_API_URL=https://<render-domain>
```

Pages 中绝对不能出现 Supabase secret/service role key 或 `LLM_KEY_ENCRYPTION_SECRET`。

5. 部署并记录最终 `https://<project>.pages.dev` 地址。

## 5. 回填 Render CORS

将 Render 的变量改为：

```text
ALLOWED_ORIGINS=https://<project>.pages.dev
```

只写 Origin，不带路径，不在末尾加 `/`。如果以后添加正式自定义域名，用英文逗号分隔：

```text
ALLOWED_ORIGINS=https://example.com,https://<project>.pages.dev
```

保存后等待 Render 自动重新部署。

## 6. 配置 Supabase Auth URL

在 Supabase Authentication → URL Configuration 设置：

```text
Site URL:
https://<project>.pages.dev

Redirect URLs:
https://<project>.pages.dev/auth/callback/
https://<project>.pages.dev/auth/reset-password/
```

如果以后增加自定义域名，应将相同的两个路径也加入 Redirect URLs，再把 Site URL 改为正式域名。

## 7. 首次验收

按顺序验证：

1. 注册账号并收到验证邮件。
2. 点击邮件后进入 `/app/`，退出后重新登录。
3. 测试忘记密码和重置密码。
4. 新建、修改、删除一条申请。
5. 在 API Key 设置页保存一条模型配置；列表只能显示末四位。
6. 测试模型连接。
7. 执行 AI 补全。
8. 上传一个小型 ZIP 源码包生成材料。
9. 确认 SSE 进度持续更新，最终生成三个下载入口。
10. 在历史页重新下载文件，确认登录鉴权和临时 URL 正常。
11. 创建第二个账号，确认看不到第一个账号的申请、Key 和历史。
12. 删除带生成记录的申请，确认数据库记录被级联删除；Storage 清理是异步尽力执行，可在 Supabase Storage 控制台抽查。

## 8. 当前运维边界

- 模型调用直接从 Render Node 发往固定的 OpenAI/DeepSeek 官方端点，不再部署 Cloudflare Worker。
- OpenAI 白名单：`gpt-5-mini`、`gpt-5.1`。
- DeepSeek 白名单：`deepseek-v4-flash`、`deepseek-v4-pro`。
- 一个账号同一时间只能执行一个文档生成任务。
- 当前生成任务依赖单条 SSE 连接；刷新页面或 Render 重启会中断当次任务。Render Free 空闲 15 分钟后会休眠，首次访问可能需要约 1 分钟唤醒；小规模使用可接受，若以后任务量明显增长，再升级为常驻服务。
- 当前 IP 限流保存在单个 Node 实例内存中；单实例小流量够用，多实例部署时应换成 Redis 等共享限流存储。

## 9. 常见故障定位

- 浏览器报 CORS：核对 Render `ALLOWED_ORIGINS` 是否与地址完全一致，且无末尾 `/`。
- 前端提示 API 未配置：修改 Pages 的 `NEXT_PUBLIC_API_URL` 后必须重新构建部署。
- 邮箱链接无效：核对 Supabase Site URL、Redirect URLs 和路径末尾 `/`。
- 模型测试 401/403：用户 Key 无效、没有余额，或账号无对应模型权限。
- 模型测试 400：先核对选择的 provider/model；服务不接受任意模型名或 Base URL。
- Storage 上传失败：核对 Bucket 名称、是否为私有桶，以及 Render 使用的 Supabase 服务端密钥是否正确。
- DOCX 转换失败：查看 Render 日志中失败阶段；日志不会输出 API Key 或提示词正文。
