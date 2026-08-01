import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function checkHomologation(
  environment = process.env,
  root = repositoryRoot,
) {
  const checks = [];
  const add = (name, passed, level = "required") => {
    checks.push({ name, passed, level });
  };

  add(
    "DATABASE_URL PostgreSQL configurada",
    isConfiguredPostgresUrl(environment.DATABASE_URL),
  );
  add(
    "ADMIN_EMAIL válido e não fictício",
    isEmail(environment.ADMIN_EMAIL) &&
      environment.ADMIN_EMAIL !== "admin@example.invalid",
  );
  add(
    "APP_ENCRYPTION_KEY com 32 bytes",
    isThirtyTwoByteBase64(environment.APP_ENCRYPTION_KEY) &&
      !isZeroEncryptionKey(environment.APP_ENCRYPTION_KEY),
  );
  add(
    "APP_HEALTH_TOKEN com no mínimo 24 caracteres",
    isConfiguredSecret(environment.APP_HEALTH_TOKEN),
  );
  add(
    "WORKER_HEALTH_TOKEN com no mínimo 24 caracteres",
    isConfiguredSecret(environment.WORKER_HEALTH_TOKEN),
  );
  add(
    "WORKER_API_TOKEN com no mínimo 24 caracteres",
    isConfiguredSecret(environment.WORKER_API_TOKEN),
  );
  add(
    "Tokens operacionais distintos",
    areDistinct([
      environment.APP_HEALTH_TOKEN,
      environment.WORKER_HEALTH_TOKEN,
      environment.WORKER_API_TOKEN,
    ]),
  );
  add("APP_URL HTTP(S) configurada", isConfiguredHttpUrl(environment.APP_URL));
  add(
    "WORKER_API_URL HTTP(S) configurada",
    isConfiguredHttpUrl(environment.WORKER_API_URL),
  );
  add(
    "SHOPEE_API_BASE_URL oficial",
    environment.SHOPEE_API_BASE_URL ===
      "https://open-api.affiliate.shopee.com.br/graphql",
  );
  add(
    "SHOPEE_APP_ID configurado quando necessário",
    !requiresLiveShopeeCredentials(environment) ||
      isConfiguredValue(environment.SHOPEE_APP_ID),
  );
  add(
    "SHOPEE_APP_SECRET configurado quando necessário",
    !requiresLiveShopeeCredentials(environment) ||
      isConfiguredValue(environment.SHOPEE_APP_SECRET),
  );
  add(
    "SHOPEE_AFFILIATE_ID configurado quando necessário",
    !requiresLiveShopeeCredentials(environment) ||
      isConfiguredValue(environment.SHOPEE_AFFILIATE_ID),
  );

  add("DEMO_MODE=true", environment.DEMO_MODE === "true");
  add("PROVIDER_MODE=mock", environment.PROVIDER_MODE === "mock");
  add("MOCK_PROVIDERS=true", environment.MOCK_PROVIDERS === "true");
  add("SEND_LIVE=false", environment.SEND_LIVE === "false");

  const whatsappEnabled = environment.WHATSAPP_ENABLED === "true";
  add(
    "Diretório persistente do WhatsApp",
    !whatsappEnabled || hasValue(environment.WHATSAPP_SESSION_DIR),
  );
  add(
    "Comportamento mock válido",
    !environment.MOCK_PROVIDER_BEHAVIOR ||
      ["SUCCESS", "FAILURE", "TIMEOUT"].includes(
        environment.MOCK_PROVIDER_BEHAVIOR,
      ),
  );

  const requiredFiles = [
    ".env.example",
    "apps/worker/Dockerfile",
    "compose.worker.homologation.yaml",
    "docs/PROJECT_GUIDE.md",
    "packages/database/prisma/schema.prisma",
  ];
  for (const path of requiredFiles) {
    add(`Arquivo presente: ${path}`, existsSync(join(root, path)));
  }

  add(
    "Migrations Prisma versionadas",
    countMigrationFiles(
      join(root, "packages/database/prisma/migrations"),
    ) > 0,
  );
  add(
    "Exatamente um .env.example",
    countNamedFiles(root, ".env.example") === 1,
  );

  add(
    "APP_URL usa HTTPS fora do ambiente local",
    isLocalOrHttps(environment.APP_URL),
    "warning",
  );
  add(
    "WORKER_API_URL usa HTTPS fora do ambiente local",
    isLocalOrHttps(environment.WORKER_API_URL),
    "warning",
  );

  return checks;
}

export function formatPreflight(checks) {
  const lines = ["Preflight de homologação — Painel Achadinhos Muito Top"];
  for (const check of checks) {
    const marker = check.passed
      ? "OK"
      : check.level === "warning"
        ? "AVISO"
        : "FALHA";
    lines.push(`[${marker}] ${check.name}`);
  }
  const failures = checks.filter(
    (check) => !check.passed && check.level === "required",
  ).length;
  const warnings = checks.filter(
    (check) => !check.passed && check.level === "warning",
  ).length;
  lines.push(
    failures === 0
      ? `Resultado: configuração aprovada${warnings ? ` com ${warnings} aviso(s)` : ""}.`
      : `Resultado: ${failures} requisito(s) pendente(s).`,
  );
  return { output: lines.join("\n"), failures, warnings };
}

function isConfiguredPostgresUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ![url.username, url.password, url.pathname.slice(1)].some(
        (part) => part.startsWith("example_"),
      ) &&
      !url.hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
}

function isConfiguredHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
}

function isLocalOrHttps(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function isEmail(value) {
  return Boolean(
    value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  );
}

function isThirtyTwoByteBase64(value) {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length === 32 && decoded.toString("base64") === value;
  } catch {
    return false;
  }
}

function isZeroEncryptionKey(value) {
  return Buffer.from(value, "base64").every((byte) => byte === 0);
}

function isConfiguredSecret(value) {
  return (
    Boolean(value && value.length >= 24) &&
    !/^(replace_|example_|fictitious)/i.test(value)
  );
}

function isConfiguredValue(value) {
  return (
    hasValue(value) &&
    !/^(replace_|example_|fictitious)/i.test(value.trim())
  );
}

function requiresLiveShopeeCredentials(environment) {
  return !(
    environment.DEMO_MODE === "true" &&
    environment.PROVIDER_MODE === "mock" &&
    environment.MOCK_PROVIDERS === "true" &&
    environment.SEND_LIVE === "false"
  );
}

function hasValue(value) {
  return Boolean(value?.trim());
}

function areDistinct(values) {
  return (
    values.every((value) => hasValue(value)) &&
    new Set(values).size === values.length
  );
}

function countMigrationFiles(directory) {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true }).filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(directory, entry.name, "migration.sql")),
  ).length;
}

function countNamedFiles(directory, filename) {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      [".git", ".next", ".turbo", "dist", "graphify-out", "node_modules"].includes(
        entry.name,
      )
    ) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += countNamedFiles(path, filename);
    else if (entry.name === filename) count += 1;
  }
  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = formatPreflight(checkHomologation());
  console.log(result.output);
  process.exitCode = result.failures === 0 ? 0 : 1;
}
