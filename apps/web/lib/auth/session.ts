import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@achadinhos/database";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminEmail, getSessionTtlMilliseconds, SESSION_COOKIE_NAME } from "./config";

export type AuthenticatedAdmin = { id: string; email: string; name: string };

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createAdminSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + getSessionTtlMilliseconds());
  await getPrisma().adminSession.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function getAuthenticatedAdmin(): Promise<AuthenticatedAdmin | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const configuredEmail = getAdminEmail();
  if (!token || !configuredEmail) return null;

  const session = await getPrisma().adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive || session.user.email !== configuredEmail) return null;

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await getPrisma().adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export async function requireAuthenticatedAdmin(): Promise<AuthenticatedAdmin> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function revokeCurrentSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await getPrisma().adminSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}
