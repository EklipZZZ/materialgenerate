import { NextRequest } from "next/server";
import { filingJobEventSchema, filingJobIdSchema } from "@/server/api-contracts";
import { getOwnedFilingJobWithEvents, recordFilingEvent } from "@/server/filing-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!filingJobIdSchema.safeParse(id).success) return fail(400, "填报任务 ID 无效");
    const parsed = filingJobEventSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return fail(400, "填报事件参数无效");
    const job = await recordFilingEvent({ jobId: id, userId: user.id, event: parsed.data });
    return ok({ job }, "填报事件已记录");
  } catch (error) {
    return errorResponse(error, "记录填报事件失败");
  }
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!filingJobIdSchema.safeParse(id).success) return fail(400, "填报任务 ID 无效");
    const result = await getOwnedFilingJobWithEvents(id, user.id);
    return result ? ok(result) : fail(404, "填报任务不存在");
  } catch (error) {
    return errorResponse(error, "获取填报事件失败");
  }
}
