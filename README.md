# 软著材料生成系统

基于 Next.js 16 + shadcn/ui 的材料生成网页应用，用于查询微信小程序采集的软件著作权信息并生成相关材料。

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

修改 `.env.local` 中的 API 地址：

```bash
NEXT_PUBLIC_SOFTREG_API_URL=https://web-production-2c115.up.railway.app
```

### 启动开发服务器

```bash
pnpm dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

### 构建生产版本

```bash
pnpm build
```

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── app/                  # 工作台页面
│   │   ├── history/          # 历史记录
│   │   └── page.tsx          # 主页面
│   ├── login/                # 登录页面
│   ├── register/             # 注册页面
│   ├── api/                  # API 路由
│   ├── layout.tsx           # 根布局组件
│   └── page.tsx             # 首页
├── components/              # React 组件目录
│   ├── ui/                  # shadcn/ui 基础组件
│   ├── copyright-form-editor.tsx    # 采集表编辑器
│   └── copyright-query-panel.tsx    # 查询面板
└── lib/                     # 工具函数库
```

## API 连接

本项目连接到部署在 Railway 的 FastAPI 后端：

- **后端地址**: `https://web-production-2c115.up.railway.app`
- **API 文档**: `https://web-production-2c115.up.railway.app/docs`

### 主要功能

1. **查询登记信息** - 通过查询码获取微信小程序提交的采集表数据
2. **生成材料** - 根据采集信息生成软著登记所需材料
3. **历史记录** - 查看已生成的材料记录

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **配置正确的 API 地址** - 在 `.env.local` 中设置 `NEXT_PUBLIC_SOFTREG_API_URL`
3. **后端服务** - 确保 Railway 后端服务处于运行状态
