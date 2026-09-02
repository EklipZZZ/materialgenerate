import { NextRequest } from "next/server";
import { applicationIdSchema } from "@/server/applications";
import { filingJobCreateSchema } from "@/server/api-contracts";
import { createFilingJob } from "@/server/filing-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!applicationIdSchema.safeParse(id).success) return fail(400, "申请 ID 无效");
    const parsed = filingJobCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return fail(400, "填报任务参数无效");
    return ok(await createFilingJob({ userId: user.id, applicationId: id, request: parsed.data }), "填报任务已创建");
  } catch (error) {
    return errorResponse(error, "创建填报任务失败");
  }
}
