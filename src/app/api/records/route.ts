import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/storage/database/supabase-client";

// 获取用户历史记录
export async function GET(request: NextRequest) {
  try {
    // 从 URL 参数获取 userId
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 获取历史记录
    const { data: records, error } = await supabaseAdmin
      .from("generation_records")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("查询历史记录失败:", error);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    return NextResponse.json({ records: records || [] });
  } catch (error) {
    console.error("获取历史记录错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
