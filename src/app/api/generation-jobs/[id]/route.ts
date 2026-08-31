import { NextRequest } from "next/server";
import { getOwnedGenerationJob, getOwnedJobEvents } from "@/server/generation-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { generationJobIdSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!generationJobIdSchema.safeParse(id).success) return fail(400, "生成任务 ID 无效");
    const job = await getOwnedGenerationJob(id, user.id);
    if (!job) return fail(404, "生成任务不存在");
    return ok({ job, events: await getOwnedJobEvents(id, user.id) });
  } catch (error) {
    return errorResponse(error, "获取生成任务失败");
  }
}
