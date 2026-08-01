import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function prepareLocalEnvironment(path = resolve(".env")) {
  const original = await readFile(path, "utf8");
  const changed = [];
  const values = {
    APP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    APP_HEALTH_TOKEN: randomBytes(32).toString("hex"),
    WORKER_HEALTH_TOKEN: randomBytes(32).toString("hex"),
    WORKER_API_TOKEN: randomBytes(32).toString("hex"),
    WORKER_API_URL: "http://127.0.0.1:9464",
    DEMO_MODE: "true",
    PROVIDER_MODE: "mock",
    MOCK_PROVIDERS: "true",
    SEND_LIVE: "false",
  };

  const lines = original.split(/\r?\n/);
  const seen = new Set();
  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || !(match[1] in values)) return line;
    const key = match[1];
    seen.add(key);
    const current = unquote(match[2]);
    if (!shouldReplace(key, current)) return line;
    changed.push(key);
    return `${key}="${values[key]}"`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (seen.has(key)) continue;
    changed.push(key);
    updated.push(`${key}="${value}"`);
  }

  const finalContent = `${updated.join("\n").replace(/\n+$/, "")}\n`;
  await writeFile(path, finalContent, { mode: 0o600 });
  await chmod(path, 0o600);
  return changed.sort();
}

export async function useDockerPostgres(
  containerName,
  path = resolve(".env"),
) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(containerName ?? "")) {
    throw new Error("Nome de container inválido.");
  }
  const raw = execFileSync("docker", ["inspect", containerName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const inspection = JSON.parse(raw)?.[0];
  if (!inspection) throw new Error("Container PostgreSQL não encontrado.");

  const variables = Object.fromEntries(
    (inspection.Config?.Env ?? []).map((entry) => {
      const separator = entry.indexOf("=");
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
  const user = variables.POSTGRES_USER;
  const password = variables.POSTGRES_PASSWORD;
  const database = variables.POSTGRES_DB;
  const port =
    inspection.NetworkSettings?.Ports?.["5432/tcp"]?.[0]?.HostPort ??
    inspection.HostConfig?.PortBindings?.["5432/tcp"]?.[0]?.HostPort;
  if (![user, password, database, port].every(hasText)) {
    throw new Error("Container PostgreSQL sem configuração compatível.");
  }

  const databaseUrl =
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@127.0.0.1:${port}/${encodeURIComponent(database)}?schema=public`;
  const workerDatabaseUrl = toWorkerDatabaseUrl(databaseUrl);
  const original = await readFile(path, "utf8");
  const updated = setEnvironmentValue(
    setEnvironmentValue(original, "DATABASE_URL", databaseUrl),
    "WORKER_DATABASE_URL",
    workerDatabaseUrl,
  );
  await writeFile(path, updated, { mode: 0o600 });
  await chmod(path, 0o600);
}

export function toWorkerDatabaseUrl(databaseUrl) {
  return databaseUrl.replace("@127.0.0.1:", "@host.docker.internal:");
}

function shouldReplace(key, value) {
  if (["DEMO_MODE", "PROVIDER_MODE", "MOCK_PROVIDERS", "SEND_LIVE"].includes(key)) {
    return value !== {
      DEMO_MODE: "true",
      PROVIDER_MODE: "mock",
      MOCK_PROVIDERS: "true",
      SEND_LIVE: "false",
    }[key];
  }
  if (key === "WORKER_API_URL") {
    try {
      return new URL(value).hostname.endsWith(".invalid");
    } catch {
      return true;
    }
  }
  if (key === "APP_ENCRYPTION_KEY") {
    try {
      const decoded = Buffer.from(value, "base64");
      return (
        decoded.length !== 32 ||
        decoded.every((byte) => byte === 0)
      );
    } catch {
      return true;
    }
  }
  return (
    value.length < 24 ||
    /^(replace_|example_|fictitious)/i.test(value)
  );
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function setEnvironmentValue(content, key, value) {
  const line = `${key}="${value}"`;
  const expression = new RegExp(`^${key}=.*$`, "m");
  if (expression.test(content)) return content.replace(expression, line);
  return `${content.replace(/\n*$/, "\n")}${line}\n`;
}

function hasText(value) {
  return typeof value === "string" && value.length > 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const databaseFlag = process.argv.indexOf("--database-container");
    if (databaseFlag >= 0) {
      await useDockerPostgres(process.argv[databaseFlag + 1]);
      console.log("DATABASE_URL configurada a partir do PostgreSQL local.");
    } else {
      const changed = await prepareLocalEnvironment();
      console.log(
        changed.length
          ? `Configuração local preparada: ${changed.join(", ")}.`
          : "Configuração local já estava preparada.",
      );
    }
  } catch (error) {
    console.error(
      error?.code === "ENOENT"
        ? "Arquivo .env não encontrado. Crie-o a partir do .env.example."
        : error instanceof Error
          ? error.message
          : "Não foi possível preparar o .env local.",
    );
    process.exitCode = 1;
  }
}
