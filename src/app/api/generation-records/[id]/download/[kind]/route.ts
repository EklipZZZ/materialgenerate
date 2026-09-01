import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/server/config";
import { errorResponse, fail, ok, requireUser } from "@/server/http";
import { signedDownloadUrl } from "@/server/storage";
import { downloadKindSchema, generationRecordIdSchema } from "@/server/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const keyFields = {
  source_code: "source_code_object_key",
  source_code_pdf: "source_code_pdf_object_key",
  user_manual: "user_manual_object_key",
  user_manual_pdf: "user_manual_pdf_object_key",
  collection_form: "collection_form_object_key",
} as const;

interface Context {
  params: Promise<{ id: string; kind: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const params = await context.params;
    if (!generationRecordIdSchema.safeParse(params.id).success) return fail(400, "生成记录 ID 无效");
    const kind = downloadKindSchema.safeParse(params.kind);
    if (!kind.success) return fail(400, "下载类型无效");
    const field = keyFields[kind.data];
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
