import { NextRequest } from "next/server";
import {
  effectiveApplication,
  getOwnedApplications,
  getOwnedApplication,
  replaceOwnedHolders,
  sanitizeApplicationPayload,
} from "@/server/applications";
import { getSupabaseAdmin } from "@/server/config";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const parsed = sanitizeApplicationPayload(await request.json());
    if (!parsed.success) return fail(400, "申请信息参数无效");
    const result = await getSupabaseAdmin().from("applications").insert({
      ...parsed.data.columns,
      user_id: user.id,
      status: "draft",
      enriched_data: null,
    }).select("*").single();
    if (result.error || !result.data) return fail(500, "创建申请失败");
    try {
      if (parsed.data.holders !== undefined) {
        await replaceOwnedHolders(result.data.id, user.id, parsed.data.holders);
      }
      const created = await getOwnedApplication(result.data.id, user.id);
      return created ? ok(effectiveApplication(created), "创建成功") : fail(500, "创建申请失败");
    } catch (error) {
      await getSupabaseAdmin().from("applications").delete().eq("id", result.data.id).eq("user_id", user.id);
      throw error;
    }
  } catch (error) {
    return errorResponse(error, "创建申请失败");
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const applications = await getOwnedApplications(user.id);
    return ok(applications.map((row) => effectiveApplication(row)));
  } catch (error) {
    return errorResponse(error, "获取申请失败");
  }
}
