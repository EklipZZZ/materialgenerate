import { Router } from "express";
import { z } from "zod";
import { effectiveApplication, getOwnedApplication } from "../applications.js";
import { requireAuth, requestUser } from "../auth.js";
import { supabaseAdmin } from "../db.js";
import { deleteObjects } from "../storage.js";
import { fail, ok } from "../response.js";

const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(20_000);
const applicationFields = z.object({
  software_full_name: shortText.optional(),
  software_short_name: shortText.optional(),
  version: shortText.optional(),
  software_category: shortText.optional(),
  development_date: z.string().trim().max(40).optional(),
  is_published: z.boolean().optional(),
  development_hardware: longText.optional(),
  runtime_hardware: longText.optional(),
  development_os: longText.optional(),
  development_tools: longText.optional(),
  runtime_platform: longText.optional(),
  runtime_environment: longText.optional(),
  programming_language: longText.optional(),
  source_code_lines: z.number().int().min(0).max(1_000_000_000).optional(),
  development_purpose: longText.optional(),
  target_industry: longText.optional(),
  main_functions: longText.optional(),
  technical_features: longText.optional(),
  company_name: shortText.optional(),
  credit_code: shortText.optional(),
}).strict();

const idSchema = z.string().uuid();

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

applicationsRouter.post("/", async (request, response) => {
  const parsed = applicationFields.safeParse(request.body);
  if (!parsed.success) return fail(response, 400, "申请信息参数无效");
  const payload = {
    ...parsed.data,
    user_id: requestUser(request).id,
    status: "draft",
    enriched_data: null,
  };
  const { data, error } = await supabaseAdmin.from("applications").insert(payload).select("*").single();
  if (error || !data) return fail(response, 500, "创建申请失败");
  return ok(response, effectiveApplication(data), "创建成功");
});

applicationsRouter.get("/", async (request, response) => {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("*")
    .eq("user_id", requestUser(request).id)
    .order("created_at", { ascending: false });
  if (error) return fail(response, 500, "获取申请失败");
  return ok(response, (data || []).map((row) => effectiveApplication(row)));
});

applicationsRouter.get("/:id", async (request, response) => {
  if (!idSchema.safeParse(request.params.id).success) return fail(response, 400, "申请 ID 无效");
  try {
    const row = await getOwnedApplication(request.params.id, requestUser(request).id);
    if (!row) return fail(response, 404, "申请不存在");
    return ok(response, effectiveApplication(row));
  } catch {
    return fail(response, 500, "获取申请失败");
  }
});

applicationsRouter.put("/:id", async (request, response) => {
  if (!idSchema.safeParse(request.params.id).success) return fail(response, 400, "申请 ID 无效");
  const parsed = applicationFields.partial().safeParse(request.body);
  if (!parsed.success) return fail(response, 400, "申请信息参数无效");
  if (Object.keys(parsed.data).length === 0) {
    try {
      const row = await getOwnedApplication(request.params.id, requestUser(request).id);
      return row ? ok(response, effectiveApplication(row)) : fail(response, 404, "申请不存在");
    } catch {
      return fail(response, 500, "获取申请失败");
    }
  }
  const { data, error } = await supabaseAdmin
    .from("applications")
    .update({
      ...parsed.data,
      status: "draft",
      enriched_data: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.params.id)
    .eq("user_id", requestUser(request).id)
    .select("*")
    .maybeSingle();
  if (error) return fail(response, 500, "更新申请失败");
  if (!data) return fail(response, 404, "申请不存在");
  return ok(response, effectiveApplication(data), "更新成功");
});

applicationsRouter.delete("/:id", async (request, response) => {
  if (!idSchema.safeParse(request.params.id).success) return fail(response, 400, "申请 ID 无效");
  const userId = requestUser(request).id;
  const records = await supabaseAdmin
    .from("generation_records")
    .select("source_code_object_key,user_manual_object_key,collection_form_object_key")
    .eq("application_id", request.params.id)
    .eq("user_id", userId);
  if (records.error) return fail(response, 500, "读取关联文件失败");

  const result = await supabaseAdmin
    .from("applications")
    .delete()
    .eq("id", request.params.id)
    .eq("user_id", userId)
    .select("id");
  if (result.error) return fail(response, 500, "删除申请失败");
  if (!result.data?.length) return fail(response, 404, "申请不存在");

  const keys = (records.data || []).flatMap((record) => [
    record.source_code_object_key,
    record.user_manual_object_key,
    record.collection_form_object_key,
  ]).filter((key): key is string => typeof key === "string" && key.length > 0);
  if (keys.length) {
    deleteObjects(keys).catch(() => console.error("Storage cleanup failed after application deletion"));
  }
  return ok(response, null, "删除成功");
});
