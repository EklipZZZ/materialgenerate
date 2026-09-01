import { NextRequest } from "next/server";
import { applicationIdSchema, getOwnedApplication } from "@/server/applications";
import { sourceArchiveCompleteSchema } from "@/server/api-contracts";
import { completeSourceArchiveUpload } from "@/server/source-archives";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ id: string }>; }

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!applicationIdSchema.safeParse(id).success) return fail(400, "申请 ID 无效");
    if (!await getOwnedApplication(id, user.id)) return fail(404, "申请不存在");
    const parsed = sourceArchiveCompleteSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "源码压缩包确认参数无效");
    return ok(await completeSourceArchiveUpload(id, user.id, parsed.data), "源码压缩包已就绪");
  } catch (error) {
    return errorResponse(error, "确认源码压缩包失败");
  }
}
