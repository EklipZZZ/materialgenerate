import { Router } from "express";
import { requireAuth, requestUser } from "../auth.js";
import { supabaseAdmin } from "../db.js";
import { signedDownloadUrl } from "../storage.js";
import { fail, ok } from "../response.js";

export const generationRecordsRouter = Router();
generationRecordsRouter.use(requireAuth);

generationRecordsRouter.get("/", async (request, response) => {
  const result = await supabaseAdmin
    .from("generation_records")
    .select("id,application_id,file_name,provider,model,status,created_at,updated_at")
    .eq("user_id", requestUser(request).id)
    .order("created_at", { ascending: false });
  if (result.error) return fail(response, 500, "读取生成历史失败");
  return ok(response, result.data || []);
});

const keyFields = {
  source_code: "source_code_object_key",
  user_manual: "user_manual_object_key",
  collection_form: "collection_form_object_key",
} as const;

generationRecordsRouter.get("/:id/download/:kind", async (request, response) => {
  const field = keyFields[request.params.kind as keyof typeof keyFields];
  if (!field) return fail(response, 400, "下载类型无效");
  const result = await supabaseAdmin
    .from("generation_records")
    .select(field)
    .eq("id", request.params.id)
    .eq("user_id", requestUser(request).id)
    .maybeSingle();
  if (result.error || !result.data) return fail(response, 404, "生成记录不存在");
  const key = (result.data as Record<string, unknown>)[field] as string | null;
  if (!key) return fail(response, 404, "该文件不可下载");
  try {
    const url = await signedDownloadUrl(key);
    return ok(response, { url });
  } catch {
    return fail(response, 500, "生成下载链接失败");
  }
});
