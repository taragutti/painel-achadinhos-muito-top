import { createHash } from "node:crypto";
import { getPrisma } from "@achadinhos/database";
import { getLoginPolicy } from "./config";

export function createThrottleKey(email: string, request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(`${email}|${forwarded}`).digest("base64url");
}

export async function isLoginBlocked(key: string): Promise<boolean> {
  const throttle = await getPrisma().loginThrottle.findUnique({ where: { key } });
  return Boolean(throttle?.blockedUntil && throttle.blockedUntil > new Date());
}

export async function recordLoginFailure(key: string): Promise<void> {
  const now = new Date();
  const policy = getLoginPolicy();
  const existing = await getPrisma().loginThrottle.findUnique({ where: { key } });
  const windowExpired = !existing || now.getTime() - existing.firstAttemptAt.getTime() > policy.windowMilliseconds;
  const failures = windowExpired ? 1 : existing.failedAttempts + 1;
  const blockedUntil = failures >= policy.maximumAttempts ? new Date(now.getTime() + policy.blockMilliseconds) : null;

  await getPrisma().loginThrottle.upsert({
    where: { key },
    create: { key, failedAttempts: failures, firstAttemptAt: now, blockedUntil },
    update: { failedAttempts: failures, firstAttemptAt: windowExpired ? now : existing.firstAttemptAt, blockedUntil },
  });
}

export async function clearLoginFailures(key: string): Promise<void> {
  await getPrisma().loginThrottle.deleteMany({ where: { key } });
}
