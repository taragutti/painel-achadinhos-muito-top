import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("loads the single root environment file during worker development", async () => {
  const [packageJson, startScript] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(
      new URL("../../../scripts/start-worker-dev.mjs", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(packageJson.scripts.dev, /start-worker-dev\.mjs/);
  assert.match(startScript, /process\.loadEnvFile\(environmentPath\)/);
  assert.match(startScript, /node_modules\/tsx\/dist\/cli\.mjs/);
});

test("worker handles graceful termination without revoking the WhatsApp session", async () => {
  const source = await readFile(
    new URL("../src/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /process\.once\("SIGTERM"/);
  assert.match(source, /process\.once\("SIGINT"/);
  assert.match(source, /clearInterval\(tickTimer\)/);
  assert.match(source, /whatsappConnector\.disconnect\(\)/);
  assert.match(source, /closeServer\(healthServer\)/);
  assert.match(source, /disconnectPrisma\(\)/);
  assert.match(source, /installSafeConsoleGuard\(\)/);
  assert.match(source, /shouldAutostartWhatsapp\(process\.env\)/);
  assert.doesNotMatch(source, /revokeSession\(\)/);
});

test("container defaults keep every live provider disabled", async () => {
  const dockerfile = await readFile(
    new URL("../Dockerfile", import.meta.url),
    "utf8",
  );

  assert.match(dockerfile, /PROVIDER_MODE=mock/);
  assert.match(dockerfile, /MOCK_PROVIDERS=true/);
  assert.match(dockerfile, /SEND_LIVE=false/);
  assert.match(dockerfile, /WHATSAPP_ENABLED=false/);
  assert.match(dockerfile, /USER node/);
});

test("homologation compose cannot enable live delivery", async () => {
  const compose = await readFile(
    new URL("../../../compose.worker.homologation.yaml", import.meta.url),
    "utf8",
  );

  assert.match(compose, /DEMO_MODE: "true"/);
  assert.match(compose, /PROVIDER_MODE: mock/);
  assert.match(compose, /MOCK_PROVIDERS: "true"/);
  assert.match(compose, /SEND_LIVE: "false"/);
  assert.match(compose, /127\.0\.0\.1:/);
  assert.match(compose, /worker_whatsapp_session:/);
  assert.doesNotMatch(compose, /docker compose down -v/);
});
