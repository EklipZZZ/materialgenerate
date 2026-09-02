import { NextRequest } from "next/server";
import { filingJobCancelSchema, filingJobIdSchema } from "@/server/api-contracts";
import { cancelFilingJob } from "@/server/filing-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!filingJobIdSchema.safeParse(id).success) return fail(400, "填报任务 ID 无效");
    const parsed = filingJobCancelSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return fail(400, "取消参数无效");
    return ok({ job: await cancelFilingJob(id, user.id) }, "填报任务已取消");
  } catch (error) {
    return errorResponse(error, "取消填报任务失败");
  }
}
