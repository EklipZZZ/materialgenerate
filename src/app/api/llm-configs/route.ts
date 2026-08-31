import { NextRequest } from "next/server";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import {
  listOwnedLlmConfigs,
  llmConfigWriteSchema,
  saveOwnedLlmConfig,
} from "@/server/llm-configs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return ok(await listOwnedLlmConfigs(user.id));
  } catch (error) {
    return errorResponse(error, "获取模型配置失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const parsed = llmConfigWriteSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "模型配置无效");
    const saved = await saveOwnedLlmConfig(user.id, parsed.data);
    return ok(saved, "模型配置已安全保存");
  } catch (error) {
    return errorResponse(error, "保存模型配置失败");
  }
}
