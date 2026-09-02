import { NextRequest } from "next/server";
import { filingProfileInputSchema } from "@/server/api-contracts";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { getOwnedFilingProfile, upsertOwnedFilingProfile } from "@/server/filing-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return ok(await getOwnedFilingProfile(user.id));
  } catch (error) {
    return errorResponse(error, "获取官网填报资料失败");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const parsed = filingProfileInputSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "官网填报资料无效");
    return ok(await upsertOwnedFilingProfile(user.id, parsed.data), "官网填报资料已保存");
  } catch (error) {
    return errorResponse(error, "保存官网填报资料失败");
  }
}
