import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/server/config";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const result = await getSupabaseAdmin().from("generation_records")
      .select("id,application_id,file_name,provider,model,status,created_at,updated_at")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (result.error) return fail(500, "读取生成历史失败");
    return ok(result.data || []);
  } catch (error) {
    return errorResponse(error, "读取生成历史失败");
  }
}
