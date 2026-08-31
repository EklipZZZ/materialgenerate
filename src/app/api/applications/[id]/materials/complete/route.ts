import { NextRequest } from "next/server";
import { applicationIdSchema, getOwnedApplication } from "@/server/applications";
import { completeMaterialUpload, materialCompleteSchema } from "@/server/materials";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (!applicationIdSchema.safeParse(id).success) return fail(400, "申请 ID 无效");
    const application = await getOwnedApplication(id, user.id);
    if (!application) return fail(404, "申请不存在");
    const parsed = materialCompleteSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "材料完成参数无效");
    const material = await completeMaterialUpload(id, user.id, parsed.data);
    return material ? ok(material, "材料已上传") : fail(404, "材料不存在");
  } catch (error) {
    return errorResponse(error, "确认材料上传失败");
  }
}
