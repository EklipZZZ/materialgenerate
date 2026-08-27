import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./config";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, msg = "操作成功", status = 200): Response {
  return Response.json({ code: status, msg, data }, { status });
}

export function fail(status: number, msg: string): Response {
  return Response.json({ code: status, msg, data: null }, { status });
}

export function errorResponse(error: unknown, fallback = "服务器内部错误"): Response {
  if (error instanceof ApiError) return fail(error.status, error.message);
  return fail(500, fallback);
}

function bearerToken(request: NextRequest): string | null {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function requireUser(request: NextRequest): Promise<AuthenticatedUser> {
  const token = bearerToken(request);
  if (!token) throw new ApiError(401, "需要登录");
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, "登录凭证无效");
    return { id: data.user.id, email: data.user.email };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "登录凭证无效");
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));
}
