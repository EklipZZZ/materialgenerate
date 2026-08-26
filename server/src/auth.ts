import type { NextFunction, Request, RequestHandler, Response } from "express";
import { supabaseAdmin } from "./db.js";
import type { AuthedRequest } from "./types.js";

function bearerToken(request: Request): string | null {
  const value = request.header("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export const requireAuth: RequestHandler = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const token = bearerToken(request);
  if (!token) {
    response.status(401).json({ code: 401, msg: "需要登录", data: null });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      response.status(401).json({ code: 401, msg: "登录凭证无效", data: null });
      return;
    }
    (request as AuthedRequest).user = { id: data.user.id, email: data.user.email };
    next();
  } catch {
    response.status(401).json({ code: 401, msg: "登录凭证无效", data: null });
  }
};

export function requestUser(request: Request) {
  const user = (request as AuthedRequest).user;
  if (!user) throw new Error("Missing authenticated user");
  return user;
}
