import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// 违禁词列表（简化版）
const FORBIDDEN_WORDS = [
  'fuck', 'shit', 'damn', 'bitch', 'ass', 'sex', 'porn'
];

// 密码强度验证：8位以上，包含字母、数字或符号
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "密码长度至少8位" };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
  if (!hasLetter && !hasNumber && !hasSymbol) {
    return { valid: false, message: "密码必须包含字母、数字或符号中至少两种" };
  }
  return { valid: true, message: "" };
}

// 用户名验证
function validateUsername(username: string): { valid: boolean; message: string } {
  if (username.length < 2 || username.length > 20) {
    return { valid: false, message: "用户名长度需在2-20个字符之间" };
  }
  // 只允许字母、数字、中文、下划线
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
    return { valid: false, message: "用户名只能包含字母、数字、中文和下划线" };
  }
  // 检查违禁词
  const lowerUsername = username.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerUsername.includes(word)) {
      return { valid: false, message: "用户名包含敏感词，请更换" };
    }
  }
  return { valid: true, message: "" };
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, confirmPassword } = await request.json();

    // 验证必填项
    if (!username || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "请填写所有必填项" },
        { status: 400 }
      );
    }

    // 验证用户名
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { error: usernameValidation.message },
        { status: 400 }
      );
    }

    // 验证密码
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // 验证确认密码
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "两次输入的密码不一致" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查用户名是否已被使用
    const { data: existingUsername } = await client
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    
    if (existingUsername) {
      return NextResponse.json(
        { error: "该用户名已被使用" },
        { status: 409 }
      );
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 12);

    // 创建用户（邮箱使用占位值，后续支持邮箱绑定时可更新）
    const { data: newUser, error: createError } = await client
      .from("users")
      .insert({
        email: `${username}@local.local`, // 占位邮箱
        username,
        password_hash: passwordHash,
      })
      .select("id, username, created_at")
      .single();

    if (createError) {
      console.error("创建用户失败:", createError);
      return NextResponse.json(
        { error: "注册失败，请稍后重试" },
        { status: 500 }
      );
    }

    // 生成会话 token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

    await client.from("auth_sessions").insert({
      user_id: newUser.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
      }
    });

    // 设置 cookie
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("注册错误:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
