const localAppUrl = new URL("http://localhost:3000");

type PublicUrlEnvironment = Readonly<Record<string, string | undefined>>;

export function getPublicAppUrl(
  environment: PublicUrlEnvironment = process.env,
) {
  const explicitUrl = parseHttpUrl(environment.APP_URL);
  const vercelUrl = parseVercelUrl(
    environment.VERCEL_PROJECT_PRODUCTION_URL ?? environment.VERCEL_URL,
  );

  if (explicitUrl && (!isLoopback(explicitUrl.hostname) || !vercelUrl)) {
    return explicitUrl;
  }

  return vercelUrl ?? explicitUrl ?? localAppUrl;
}

function parseVercelUrl(value: string | undefined) {
  if (!value) return null;
  return parseHttpUrl(value.includes("://") ? value : `https://${value}`);
}

function parseHttpUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
