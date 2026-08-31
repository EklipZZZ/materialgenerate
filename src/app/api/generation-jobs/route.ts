import { NextRequest } from "next/server";
import {
  getLatestOwnedGenerationJob,
  getOwnedJobEvents,
} from "@/server/generation-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { applicationIdSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const applicationId = request.nextUrl.searchParams.get("applicationId");
    if (!applicationId || !applicationIdSchema.safeParse(applicationId).success) {
      return fail(400, "申请 ID 无效");
    }
    const job = await getLatestOwnedGenerationJob(applicationId, user.id);
    if (!job) return ok(null);
    return ok({ job, events: await getOwnedJobEvents(job.id, user.id) });
  } catch (error) {
    return errorResponse(error, "获取生成任务失败");
  }
}
