import { NextRequest } from "next/server";
import { byokSchema } from "@/server/models";
import { testLlm } from "@/server/llm";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
    const parsed = byokSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "模型配置无效");
    await testLlm(parsed.data);
    return ok(null, "模型连接正常");
  } catch (error) {
    return errorResponse(error, "模型连接测试失败，请检查 API Key 和模型配置");
  }
}
