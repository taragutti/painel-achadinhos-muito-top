import { fakePasswordCheck, verifyPassword } from "@achadinhos/database/auth";
import { getPrisma } from "@achadinhos/database";
import { loginInputSchema } from "@achadinhos/shared";
import { NextResponse } from "next/server";
import { getAdminEmail, SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { hasValidRequestOrigin } from "@/lib/auth/request";
import { createAdminSession } from "@/lib/auth/session";
import { clearLoginFailures, createThrottleKey, isLoginBlocked, recordLoginFailure } from "@/lib/auth/throttle";

const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });

  const parsed = loginInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 400 });

  const configuredEmail = getAdminEmail();
  if (!configuredEmail) {
    console.error("Authentication configuration missing", { code: "ADMIN_EMAIL_MISSING" });
    return NextResponse.json({ error: "Acesso temporariamente indisponível." }, { status: 503 });
  }

  const throttleKey = createThrottleKey(parsed.data.email, request);
  if (await isLoginBlocked(throttleKey)) {
    return NextResponse.json({ error: "Não foi possível entrar. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }

  const admin = await getPrisma().user.findUnique({ where: { email: configuredEmail } });
  const emailMatches = parsed.data.email === configuredEmail;
  const passwordMatches = admin ? await verifyPassword(parsed.data.password, admin.passwordHash) : await fakePasswordCheck(parsed.data.password);

  if (!admin || !admin.isActive || !emailMatches || !passwordMatches) {
    await recordLoginFailure(throttleKey);
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  await clearLoginFailures(throttleKey);
  await getPrisma().user.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  const session = await createAdminSession(admin.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
