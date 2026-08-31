import { NextRequest } from "next/server";
import { getOwnedLlmSecret } from "@/server/llm-configs";
import { testLlm } from "@/server/llm";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { llmConfigIdSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!llmConfigIdSchema.safeParse(id).success) return fail(400, "模型配置 ID 无效");
    const secret = await getOwnedLlmSecret(user.id, id);
    if (!secret) return fail(404, "模型配置不存在");
    await testLlm(secret);
    return ok(null, "模型连接正常");
  } catch (error) {
    return errorResponse(error, "模型连接测试失败，请检查 API Key 和模型配置");
  }
}
