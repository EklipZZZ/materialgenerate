import { NextRequest } from "next/server";
import { deleteOwnedLlmConfig } from "@/server/llm-configs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { llmConfigIdSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!llmConfigIdSchema.safeParse(id).success) return fail(400, "模型配置 ID 无效");
    const deleted = await deleteOwnedLlmConfig(user.id, id);
    return deleted ? ok(null, "模型配置已删除") : fail(404, "模型配置不存在");
  } catch (error) {
    return errorResponse(error, "删除模型配置失败");
  }
}
