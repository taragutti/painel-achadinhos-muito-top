type WorkerEnvironment = Readonly<Record<string, string | undefined>>;

export function shouldAutostartWhatsapp(
  environment: WorkerEnvironment = process.env,
): boolean {
  return (
    environment.WHATSAPP_ENABLED === "true" &&
    environment.SEND_LIVE === "true" &&
    environment.PROVIDER_MODE === "live" &&
    environment.MOCK_PROVIDERS === "false" &&
    environment.DEMO_MODE !== "true"
  );
}

export function validateWorkerEnvironment(
  environment: WorkerEnvironment = process.env,
): void {
  const issues = new Set<string>();

  requirePostgresUrl(environment.DATABASE_URL, issues);
  requireSecret(environment.WORKER_HEALTH_TOKEN, "WORKER_HEALTH_TOKEN", issues);
  requireSecret(environment.WORKER_API_TOKEN, "WORKER_API_TOKEN", issues);
  requirePositiveInteger(
    environment.WORKER_POLL_INTERVAL_MS ?? "5000",
    "WORKER_POLL_INTERVAL_MS",
    issues,
  );
  requireIntegerInRange(
    environment.DELIVERY_MAX_ATTEMPTS ?? "3",
    "DELIVERY_MAX_ATTEMPTS",
    1,
    3,
    issues,
  );
  requirePositiveInteger(
    environment.QUEUE_LOCK_LEASE_SECONDS ?? "120",
    "QUEUE_LOCK_LEASE_SECONDS",
    issues,
  );
  requirePort(
    environment.PORT ?? environment.WORKER_HEALTH_PORT ?? "9464",
    issues,
  );

  if (environment.SEND_LIVE === "true") {
    if (environment.DEMO_MODE === "true") issues.add("DEMO_MODE");
    if (environment.PROVIDER_MODE !== "live") issues.add("PROVIDER_MODE");
    if (environment.MOCK_PROVIDERS !== "false") issues.add("MOCK_PROVIDERS");

    const telegramEnabled = environment.TELEGRAM_ENABLED === "true";
    const whatsappEnabled = environment.WHATSAPP_ENABLED === "true";
    if (!telegramEnabled && !whatsappEnabled) {
      issues.add("TELEGRAM_ENABLED ou WHATSAPP_ENABLED");
    }
    if (telegramEnabled) {
      requireValue(environment.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN", issues);
      requireValue(environment.TELEGRAM_GROUP_ID, "TELEGRAM_GROUP_ID", issues);
    }
    if (whatsappEnabled) {
      requireValue(
        environment.WHATSAPP_SESSION_DIR,
        "WHATSAPP_SESSION_DIR",
        issues,
      );
    }
  }

  if (issues.size > 0) {
    throw new Error(
      `Configuração inválida do worker: ${[...issues].sort().join(", ")}.`,
    );
  }
}

function requirePostgresUrl(
  value: string | undefined,
  issues: Set<string>,
): void {
  if (!value) {
    issues.add("DATABASE_URL");
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      issues.add("DATABASE_URL");
    }
  } catch {
    issues.add("DATABASE_URL");
  }
}

function requireSecret(
  value: string | undefined,
  name: string,
  issues: Set<string>,
): void {
  if (!value || value.length < 24) issues.add(name);
}

function requireValue(
  value: string | undefined,
  name: string,
  issues: Set<string>,
): void {
  if (!value?.trim()) issues.add(name);
}

function requirePositiveInteger(
  value: string,
  name: string,
  issues: Set<string>,
): void {
  requireIntegerInRange(value, name, 1, Number.MAX_SAFE_INTEGER, issues);
}

function requireIntegerInRange(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
  issues: Set<string>,
): void {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    issues.add(name);
  }
}

function requirePort(value: string, issues: Set<string>): void {
  requireIntegerInRange(value, "PORT ou WORKER_HEALTH_PORT", 1, 65_535, issues);
}
