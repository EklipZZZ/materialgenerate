import { NextRequest } from "next/server";
import {
  effectiveApplication,
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
      ...parsed.data,
      user_id: user.id,
      status: "draft",
      enriched_data: null,
    }).select("*").single();
    if (result.error || !result.data) return fail(500, "创建申请失败");
    return ok(effectiveApplication(result.data), "创建成功");
  } catch (error) {
    return errorResponse(error, "创建申请失败");
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const result = await getSupabaseAdmin()
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (result.error) return fail(500, "获取申请失败");
    return ok((result.data || []).map((row) => effectiveApplication(row)));
  } catch (error) {
    return errorResponse(error, "获取申请失败");
  }
}
