import type { RequestHandler } from "express";
import { env } from "./env.js";

interface Bucket {
  count: number;
  resetAt: number;
}

function limiter(max: number): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, env.rateLimitWindowMs);
  cleanup.unref();

  return (request, response, next) => {
    if (request.method === "OPTIONS") return next();
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + env.rateLimitWindowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader("RateLimit-Limit", String(max));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      response.status(429).json({ code: 429, msg: "请求过于频繁，请稍后再试", data: null });
      return;
    }
    next();
  };
}

export const apiRateLimit = limiter(env.rateLimitMax);
export const aiRateLimit = limiter(env.aiRateLimitMax);
