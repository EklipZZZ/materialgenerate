import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/server/config";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { signedDownloadUrl } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const keyFields = {
  source_code: "source_code_object_key",
  user_manual: "user_manual_object_key",
  collection_form: "collection_form_object_key",
} as const;

interface Context {
  params: Promise<{ id: string; kind: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const params = await context.params;
    if (!idSchema.safeParse(params.id).success) return fail(400, "生成记录 ID 无效");
    const field = keyFields[params.kind as keyof typeof keyFields];
    if (!field) return fail(400, "下载类型无效");
    const result = await getSupabaseAdmin().from("generation_records")
      .select(field).eq("id", params.id).eq("user_id", user.id).maybeSingle();
    if (result.error || !result.data) return fail(404, "生成记录不存在");
    const key = (result.data as Record<string, unknown>)[field];
    if (typeof key !== "string" || !key) return fail(404, "该文件不可下载");
    return ok({ url: await signedDownloadUrl(key) });
  } catch (error) {
    return errorResponse(error, "生成下载链接失败");
  }
}
