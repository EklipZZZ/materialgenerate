import { NextRequest } from "next/server";
import { applicationIdSchema } from "@/server/applications";
import { deleteOwnedMaterial } from "@/server/materials";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { materialIdSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string; materialId: string }>;
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const params = await context.params;
    if (!applicationIdSchema.safeParse(params.id).success || !materialIdSchema.safeParse(params.materialId).success) {
      return fail(400, "材料 ID 无效");
    }
    const deleted = await deleteOwnedMaterial(params.id, user.id, params.materialId);
    return deleted ? ok(null, "材料已删除") : fail(404, "材料不存在");
  } catch (error) {
    return errorResponse(error, "删除材料失败");
  }
}
