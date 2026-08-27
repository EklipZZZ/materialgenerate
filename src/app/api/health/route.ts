import { ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return ok({ ok: true, service: "materialgenerate" });
}
