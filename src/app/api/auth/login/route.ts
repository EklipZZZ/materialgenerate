import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "请输入用户名和密码" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 优先用用户名查找，找不到再用邮箱查找
    let { data: user, error: findError } = await client
      .from("users")
      .select("id, email, username, password_hash, created_at")
      .eq("username", username)
      .maybeSingle();

    // 如果没找到用户名，尝试邮箱
    if (!user) {
      const emailResult = await client
        .from("users")
        .select("id, email, username, password_hash, created_at")
        .eq("email", username)
        .maybeSingle();
      user = emailResult.data;
      findError = emailResult.error;
    }

    if (findError) {
      console.error("查询用户失败:", findError);
      return NextResponse.json(
        { error: "登录失败，请稍后重试" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 删除旧会话
    await client
      .from("auth_sessions")
      .delete()
      .eq("user_id", user.id);

    // 生成新 token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.from("auth_sessions").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      }
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("登录错误:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
