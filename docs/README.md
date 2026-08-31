# 软著申报助手开发文档

## 文档定位

这套文档面向当前项目的开发者、维护者和后续接入浏览器智能体的工程人员。文档以中文为主，接口路径、数据库字段和代码类型保留英文原名。

当前文档只覆盖软著材料生成应用，不覆盖专利项目，也不描述官方版权登记网站的自动填报实现。

## 文档索引

- [软著第一阶段需求](./requirements/softreg-phase1.md)：说明用户目标、功能范围和验收标准。
- [系统架构](./architecture.md)：说明页面、API、Supabase、LLM、DOCX/PDF 和 SSE 任务之间的关系。
- [领域模型](./domain-model.md)：说明申请、著作权人、材料、任务和模型配置的数据含义与状态。
- [API 接口说明](./api.md)：面向开发者的人类可读接口说明。
- [OpenAPI 机器契约](./openapi.json)：由共享 Zod schema 自动生成的 OpenAPI 3.1.0 JSON。
- [测试与验收](./testing.md)：说明自动化测试、场景测试和上线前检查。
- [ADR-001：使用 Zod 而不是 Pydantic](./decisions/ADR-001-zod-over-pydantic.md)：记录数据校验技术选型。

## 信息源优先级

同一内容出现冲突时，按以下顺序处理：

（1）实际运行代码和测试；

（2）Supabase migration 中的数据库约束与 RLS policy；

（3）`src/server/api-contracts.ts` 中的请求校验 schema；

（4）`docs/openapi.json`；

（5）本目录中的说明性文档。

说明性文档不得掩盖代码的实际行为。发现不一致时，应在同一提交中修正代码、契约和文档。

## 日常维护规则

新增或修改 API 时：

（1）先更新共享 Zod schema 或新增 schema；

（2）更新 `src/server/openapi.ts` 的路径、请求体、响应体和错误说明；

（3）运行 `pnpm api:generate` 更新 `docs/openapi.json`；

（4）同步更新 [api.md](./api.md) 和相关需求、架构或领域模型说明；

（5）运行 `pnpm test`，确认接口覆盖检查通过。

新增数据库表、字段、约束或 RLS 时，应新增或修改 `supabase/migrations/` 中的 SQL，并同步更新 [domain-model.md](./domain-model.md)。

## 常用命令

```bash
pnpm api:generate
pnpm api:check
pnpm test
pnpm ts-check
pnpm lint
pnpm build
```

`api:generate` 会更新 OpenAPI 文件；`api:check` 只检查文件是否过期以及 API route 是否完整，不会修改仓库文件。

## 当前边界

当前系统能够生成软著申请相关 DOCX/PDF、保存申请信息、管理材料状态和保存模型配置。当前系统不会自动登录或操作官方登记网站，也不会自动签名、盖章或伪造合作开发协议。
