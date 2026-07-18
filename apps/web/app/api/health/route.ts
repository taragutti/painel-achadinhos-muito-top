import { createHash, timingSafeEqual } from "node:crypto";
import { getPrisma } from "@achadinhos/database";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
function authorized(request: Request) {
  const expected = process.env.APP_HEALTH_TOKEN;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(left, right);
}
export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json(
      { status: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  const started = performance.now();
  try {
    await Promise.race([
      getPrisma().$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000),
      ),
    ]);
    return NextResponse.json(
      {
        status: "ok",
        service: "web",
        database: "ok",
        simulation: process.env.DEMO_MODE === "true",
        sendLive: false,
        responseTimeMs: Math.round(performance.now() - started),
        timestamp: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "web",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
