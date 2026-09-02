import { NextRequest } from "next/server";
import { applicationIdSchema } from "@/server/api-contracts";
import { getLatestOwnedFilingJob } from "@/server/filing-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const applicationId = request.nextUrl.searchParams.get("applicationId") || "";
    if (!applicationIdSchema.safeParse(applicationId).success) return fail(400, "申请 ID 无效");
    return ok(await getLatestOwnedFilingJob(applicationId, user.id));
  } catch (error) {
    return errorResponse(error, "获取最近填报任务失败");
  }
}
