# ADR-001：TypeScript 边界使用 Zod，不引入 Pydantic

## 状态

已接受

## 日期

2026-08-31

## 背景

当前应用是 Next.js + TypeScript，页面和 Route Handler 共享 TypeScript 类型。项目中的 Python 部分只负责有限的文档转换任务，不是独立的业务 API 或数据服务。

申请、著作权人、材料、生成任务和模型配置需要在 HTTP 边界校验，也需要由 Supabase 保存和隔离。

## 决策

（1）TypeScript 页面和 API 使用 Zod 作为请求校验和 API contract 的来源；

（2）Supabase 使用 SQL 字段类型、约束、migration 和 RLS 管理数据库；

（3）OpenAPI 从共享 Zod schema 生成；

（4）本阶段不在 Python 依赖中加入 Pydantic；

（5）如果未来出现独立 Python 文档或浏览器服务，再在 Python 服务边界评估 Pydantic，并通过版本化 JSON Schema 或 OpenAPI 对齐 TypeScript。

## 原因

这样可以避免同一请求体同时维护一份 TypeScript Zod 模型和一份 Python Pydantic 模型。当前实现不需要跨语言业务对象，也没有 Python 常驻服务需要处理复杂请求生命周期。

## 后果

优点：

（1）前端、Route Handler 和 OpenAPI 可以共享同一套请求 schema；

（2）无需额外维护 Python 业务模型；

（3）数据库权限和数据约束继续由 Supabase 负责。

代价：

（1）如果未来 Python 服务成为独立 API，需要建立跨语言 schema 同步机制；

（2）Zod schema 主要描述运行时请求，不替代数据库 migration 和 RLS。

## 重新评估条件

出现以下任一情况时重新评估：

（1）Python 服务开始直接接收外部业务请求；

（2）Python 服务拥有独立的队列、任务和持久化模型；

（3）同一业务 schema 需要在 TypeScript 和 Python 之间长期共享；

（4）需要使用 Python 生态的复杂数据校验、序列化或 ETL 能力。
