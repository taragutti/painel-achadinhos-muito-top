import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  prepareLocalEnvironment,
  toWorkerDatabaseUrl,
} from "./prepare-local-env.mjs";

test("prepares safe local values without returning secrets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "achadinhos-env-"));
  const path = join(directory, ".env");
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      path,
      [
        'APP_ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
        'APP_HEALTH_TOKEN="replace_with_random_health_token"',
        'WORKER_HEALTH_TOKEN="replace_with_different_random_health_token"',
        'WORKER_API_TOKEN="replace_with_random_worker_control_token"',
        'WORKER_API_URL="https://worker.example.invalid"',
        'DEMO_MODE="false"',
        'PROVIDER_MODE="live"',
        'MOCK_PROVIDERS="false"',
        'SEND_LIVE="true"',
      ].join("\n"),
    ),
  );

  const changed = await prepareLocalEnvironment(path);
  const content = await readFile(path, "utf8");
  assert.deepEqual(changed, [
    "APP_ENCRYPTION_KEY",
    "APP_HEALTH_TOKEN",
    "DEMO_MODE",
    "MOCK_PROVIDERS",
    "PROVIDER_MODE",
    "SEND_LIVE",
    "WORKER_API_TOKEN",
    "WORKER_API_URL",
    "WORKER_HEALTH_TOKEN",
  ]);
  assert.match(content, /DEMO_MODE="true"/);
  assert.match(content, /PROVIDER_MODE="mock"/);
  assert.match(content, /MOCK_PROVIDERS="true"/);
  assert.match(content, /SEND_LIVE="false"/);
  assert.match(content, /WORKER_API_URL="http:\/\/127\.0\.0\.1:9464"/);
  assert.doesNotMatch(content, /replace_|example\.invalid/);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("preserves already configured secrets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "achadinhos-env-"));
  const path = join(directory, ".env");
  const configuredToken = "already-configured-private-token-value";
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      path,
      [
        `APP_HEALTH_TOKEN="${configuredToken}"`,
        'DEMO_MODE="true"',
        'PROVIDER_MODE="mock"',
        'MOCK_PROVIDERS="true"',
        'SEND_LIVE="false"',
      ].join("\n"),
    ),
  );

  const changed = await prepareLocalEnvironment(path);
  const content = await readFile(path, "utf8");
  assert.match(content, new RegExp(configuredToken));
  assert.ok(!changed.includes("APP_HEALTH_TOKEN"));
});

test("points the Docker worker at the host PostgreSQL", () => {
  assert.equal(
    toWorkerDatabaseUrl(
      "postgresql://user:password@127.0.0.1:55432/db?schema=public",
    ),
    "postgresql://user:password@host.docker.internal:55432/db?schema=public",
  );
});
