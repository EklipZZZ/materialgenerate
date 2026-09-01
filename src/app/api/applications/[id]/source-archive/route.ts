import { NextRequest } from "next/server";
import { applicationIdSchema, getOwnedApplication } from "@/server/applications";
import { clearOwnedSourceArchive, getOwnedSourceArchive } from "@/server/source-archives";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ id: string }>; }

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!applicationIdSchema.safeParse(id).success) return fail(400, "申请 ID 无效");
    if (!await getOwnedApplication(id, user.id)) return fail(404, "申请不存在");
    const current = await getOwnedSourceArchive(id, user.id);
    return ok(current?.archive || null);
  } catch (error) {
    return errorResponse(error, "获取源码压缩包失败");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!applicationIdSchema.safeParse(id).success) return fail(400, "申请 ID 无效");
    if (!await getOwnedApplication(id, user.id)) return fail(404, "申请不存在");
    await clearOwnedSourceArchive(id, user.id);
    return ok(null, "源码压缩包已删除");
  } catch (error) {
    return errorResponse(error, "删除源码压缩包失败");
  }
}
