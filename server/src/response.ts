import type { Response } from "express";

export function ok<T>(response: Response, data: T, msg = "操作成功") {
  return response.json({ code: 200, msg, data });
}

export function fail(response: Response, status: number, msg: string) {
  return response.status(status).json({ code: status, msg, data: null });
}
