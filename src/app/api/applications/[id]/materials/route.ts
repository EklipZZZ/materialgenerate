import { NextRequest } from "next/server";
import { applicationIdSchema, getOwnedApplication } from "@/server/applications";
import { listOwnedMaterials } from "@/server/materials";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!applicationIdSchema.safeParse(id).success) return fail(400, "申请 ID 无效");
    const application = await getOwnedApplication(id, user.id);
    if (!application) return fail(404, "申请不存在");
    return ok(await listOwnedMaterials(id, user.id, String(application.development_method || "independent")));
  } catch (error) {
    return errorResponse(error, "获取申请材料失败");
  }
}
