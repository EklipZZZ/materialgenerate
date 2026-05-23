import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (token) {
      const client = getSupabaseClient();
      await client.from("auth_sessions").delete().eq("token", token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("auth_token");

    return response;
  } catch (error) {
    console.error("登出错误:", error);
    const response = NextResponse.json({ success: true });
    response.cookies.delete("auth_token");
    return response;
  }
}
