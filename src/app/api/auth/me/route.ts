import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const client = getSupabaseClient();

    // 查找会话
    const { data: session } = await client
      .from("auth_sessions")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ user: null });
    }

    // 检查是否过期
    if (new Date(session.expires_at) < new Date()) {
      await client.from("auth_sessions").delete().eq("token", token);
      return NextResponse.json({ user: null });
    }

    // 获取用户信息
    const { data: user } = await client
      .from("users")
      .select("id, email, username, created_at")
      .eq("id", session.user_id)
      .single();

    return NextResponse.json({
      user: user ? {
        id: user.id,
        email: user.email,
        username: user.username,
        created_at: user.created_at,
      } : null
    });
  } catch (error) {
    console.error("获取用户信息错误:", error);
    return NextResponse.json({ user: null });
  }
}
