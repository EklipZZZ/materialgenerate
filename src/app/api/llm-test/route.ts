import { NextRequest } from "next/server";
import { getOwnedLlmSecret } from "@/server/llm-configs";
import { getLlmFailureInfo, testLlm } from "@/server/llm";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { llmTestRequestSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = llmTestRequestSchema;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "模型配置无效");
    const config = await getOwnedLlmSecret(user.id, parsed.data.llmConfigId);
    if (!config) return fail(404, "模型配置不存在");
    await testLlm(config);
    return ok(null, "模型连接正常");
  } catch (error) {
    const failure = getLlmFailureInfo(error);
    if (failure) return fail(502, failure.userMessage);
    return errorResponse(error, "模型连接测试失败，请检查 API Key 和模型配置");
  }
}
