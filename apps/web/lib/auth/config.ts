export const SESSION_COOKIE_NAME = "achadinhos_session";

export function getAdminEmail(): string | null {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function getSessionTtlMilliseconds(): number {
  return boundedInteger(process.env.SESSION_TTL_HOURS, 8, 1, 168) * 60 * 60 * 1000;
}

export function getLoginPolicy() {
  return {
    maximumAttempts: boundedInteger(process.env.LOGIN_MAX_ATTEMPTS, 5, 3, 20),
    windowMilliseconds: boundedInteger(process.env.LOGIN_WINDOW_MINUTES, 15, 1, 60) * 60 * 1000,
    blockMilliseconds: boundedInteger(process.env.LOGIN_BLOCK_MINUTES, 15, 1, 1440) * 60 * 1000,
  };
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
