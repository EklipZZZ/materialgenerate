import { NextRequest } from "next/server";
import {
  applicationIdSchema,
  effectiveApplication,
  getOwnedApplication,
  replaceOwnedHolders,
  sanitizeApplicationPayload,
} from "@/server/applications";
import { getSupabaseAdmin } from "@/server/config";
import { deleteObjects } from "@/server/storage";
import { errorResponse, fail, ok, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

async function getId(context: Context): Promise<string | null> {
  const id = (await context.params).id;
  return applicationIdSchema.safeParse(id).success ? id : null;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = await getId(context);
    if (!id) return fail(400, "申请 ID 无效");
    const row = await getOwnedApplication(id, user.id);
    return row ? ok(effectiveApplication(row)) : fail(404, "申请不存在");
  } catch (error) {
    return errorResponse(error, "获取申请失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = await getId(context);
    if (!id) return fail(400, "申请 ID 无效");
    const parsed = sanitizeApplicationPayload(await request.json());
    if (!parsed.success) return fail(400, "申请信息参数无效");
    if (Object.keys(parsed.data.columns).length === 0 && parsed.data.holders === undefined) {
      const row = await getOwnedApplication(id, user.id);
      return row ? ok(effectiveApplication(row)) : fail(404, "申请不存在");
    }
    const result = await getSupabaseAdmin().from("applications").update({
      ...parsed.data.columns,
      status: "draft",
      enriched_data: null,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("user_id", user.id).select("*").maybeSingle();
    if (result.error) return fail(500, "更新申请失败");
    if (!result.data) return fail(404, "申请不存在");
    if (parsed.data.holders !== undefined) {
      await replaceOwnedHolders(id, user.id, parsed.data.holders);
    }
    const updated = await getOwnedApplication(id, user.id);
    return updated ? ok(effectiveApplication(updated), "更新成功") : fail(404, "申请不存在");
  } catch (error) {
    return errorResponse(error, "更新申请失败");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = await getId(context);
    if (!id) return fail(400, "申请 ID 无效");
    const records = await getSupabaseAdmin().from("generation_records")
      .select("source_code_object_key,user_manual_object_key,collection_form_object_key,source_code_pdf_object_key,user_manual_pdf_object_key,application_summary_pdf_object_key")
      .eq("application_id", id).eq("user_id", user.id);
    if (records.error) return fail(500, "读取关联文件失败");
    const materials = await getSupabaseAdmin().from("application_materials")
      .select("object_key")
      .eq("application_id", id).eq("user_id", user.id);
    if (materials.error) return fail(500, "读取关联材料失败");
    const sourceArchive = await getSupabaseAdmin().from("application_source_archives")
      .select("object_key")
      .eq("application_id", id).eq("user_id", user.id).maybeSingle();
    if (sourceArchive.error) return fail(500, "读取关联源码压缩包失败");
    const result = await getSupabaseAdmin().from("applications")
      .delete().eq("id", id).eq("user_id", user.id).select("id");
    if (result.error) return fail(500, "删除申请失败");
    if (!result.data?.length) return fail(404, "申请不存在");
    const keys = (records.data || []).flatMap((record) => [
      record.source_code_object_key,
      record.user_manual_object_key,
      record.collection_form_object_key,
      record.source_code_pdf_object_key,
      record.user_manual_pdf_object_key,
      record.application_summary_pdf_object_key,
    ]).concat((materials.data || []).map((material) => material.object_key), sourceArchive.data?.object_key).filter((key): key is string => typeof key === "string" && key.length > 0);
    if (keys.length) void deleteObjects(keys).catch(() => undefined);
    return ok(null, "删除成功");
  } catch (error) {
    return errorResponse(error, "删除申请失败");
  }
}
