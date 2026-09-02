import { NextRequest } from "next/server";
import { filingJobIdSchema, filingJobResumeSchema } from "@/server/api-contracts";
import { resumeFilingJob } from "@/server/filing-jobs";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!filingJobIdSchema.safeParse(id).success) return fail(400, "填报任务 ID 无效");
    const parsed = filingJobResumeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return fail(400, "恢复参数无效");
    const extensionVersion = request.headers.get("x-filing-extension-version")?.trim().slice(0, 40) || undefined;
    return ok(await resumeFilingJob(id, user.id, extensionVersion), "填报任务已准备恢复");
  } catch (error) {
    return errorResponse(error, "恢复填报任务失败");
  }
}
