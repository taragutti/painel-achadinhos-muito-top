import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/", import.meta.url);

test("loads the single root environment file during local development", async () => {
  const [packageJson, startScript] = await Promise.all([
    readFile(new URL("../package.json", appRoot), "utf8").then(JSON.parse),
    readFile(
      new URL("../../../scripts/start-web-dev.mjs", appRoot),
      "utf8",
    ),
  ]);

  assert.match(packageJson.scripts.dev, /start-web-dev\.mjs/);
  assert.match(startScript, /process\.loadEnvFile\(environmentPath\)/);
  assert.match(startScript, /node_modules\/next\/dist\/bin\/next/);
});

test("uses the stable Vercel production URL instead of a loopback APP_URL", async () => {
  const [layout, storage, publicUrl] = await Promise.all([
    readFile(new URL("layout.tsx", appRoot), "utf8"),
    readFile(new URL("../lib/products/storage.ts", appRoot), "utf8"),
    readFile(new URL("../lib/runtime/public-url.ts", appRoot), "utf8"),
  ]);

  assert.match(layout, /metadataBase:\s*getPublicAppUrl\(\)/);
  assert.match(storage, /const baseUrl = getPublicAppUrl\(\)/);
  assert.match(publicUrl, /VERCEL_PROJECT_PRODUCTION_URL/);
  assert.match(publicUrl, /VERCEL_URL/);
  assert.match(publicUrl, /isLoopback\(explicitUrl\.hostname\)/);
});

test("passes deployment configuration through the Turborepo build boundary", async () => {
  const turbo = await readFile(
    new URL("../../../turbo.json", appRoot),
    "utf8",
  ).then(JSON.parse);
  const buildEnvironment = new Set(turbo.tasks.build.env);

  for (const name of [
    "DATABASE_URL",
    "APP_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
    "APP_ENCRYPTION_KEY",
    "DEMO_MODE",
    "PROVIDER_MODE",
    "MOCK_PROVIDERS",
    "SEND_LIVE",
    "WORKER_API_URL",
    "WORKER_API_TOKEN",
  ]) {
    assert.ok(buildEnvironment.has(name), `missing build environment: ${name}`);
  }
});

test("defines the private administrator login without public account flows", async () => {
  const [loginPage, loginForm] = await Promise.all([
    readFile(new URL("login/page.tsx", appRoot), "utf8"),
    readFile(new URL("../components/auth/LoginForm.tsx", appRoot), "utf8"),
  ]);
  assert.match(loginPage, /ACESSO RESTRITO/);
  assert.match(loginForm, /Não há cadastro público/);
  assert.match(loginForm, /loginInputSchema\.safeParse/);
});

test("protects every internal route through the private server layout", async () => {
  const privateLayout = await readFile(new URL("(private)/layout.tsx", appRoot), "utf8");
  assert.match(privateLayout, /requireAuthenticatedAdmin/);
  assert.match(privateLayout, /force-dynamic/);

  const expectedRoutes = ["dashboard", "publicacoes", "publicacoes/nova", "produtos", "filas", "agendamentos", "canais", "modelos", "historico", "integracoes", "configuracoes"];
  await Promise.all(expectedRoutes.map(async route => {
    const page = await readFile(new URL(`(private)/${route}/page.tsx`, appRoot), "utf8");
    assert.ok(page.length > 0, `missing protected page: ${route}`);
  }));
});

test("sets secure session cookie attributes and generic login errors", async () => {
  const loginRoute = await readFile(new URL("api/auth/login/route.ts", appRoot), "utf8");
  assert.match(loginRoute, /httpOnly:\s*true/);
  assert.match(loginRoute, /sameSite:\s*"lax"/);
  assert.match(loginRoute, /NODE_ENV === "production"/);
  assert.match(loginRoute, /E-mail ou senha inválidos\./);
  assert.doesNotMatch(loginRoute, /usuário não encontrado|e-mail não existe/i);
});

test("protects health, mutations and demo mode with fail-closed boundaries", async () => {
  const [health, demo, factory, nextConfig] = await Promise.all([
    readFile(new URL("api/health/route.ts", appRoot), "utf8"),
    readFile(new URL("api/demo/route.ts", appRoot), "utf8"),
    readFile(new URL("../../../packages/providers/src/messaging/factory.ts", appRoot), "utf8"),
    readFile(new URL("../next.config.ts", appRoot), "utf8"),
  ]);
  assert.match(health, /APP_HEALTH_TOKEN/);
  assert.match(health, /status: 401/);
  assert.match(demo, /getAuthenticatedAdmin/);
  assert.match(demo, /hasValidRequestOrigin/);
  assert.match(factory, /DEMO_MODE === "true"/);
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /frame-ancestors 'none'/);
});

test("keeps operational controls and destructive confirmations visible", async () => {
  const [dashboard, queues, products, publications] = await Promise.all([
    readFile(new URL("../components/dashboard/DashboardView.tsx", appRoot), "utf8"),
    readFile(new URL("../components/queues/QueueManager.tsx", appRoot), "utf8"),
    readFile(new URL("../components/products/ProductsView.tsx", appRoot), "utf8"),
    readFile(new URL("../components/publications/PublicationsView.tsx", appRoot), "utf8"),
  ]);
  assert.match(dashboard, /Pausar tudo/i);
  assert.match(dashboard, /Retomar/i);
  assert.match(queues, /<ConfirmDialog/);
  assert.match(queues, /reorder|orden/i);
  assert.match(products, /duplicate|duplicar/i);
  assert.match(publications, /Publicar em teste/i);
});

test("uses one serialized queue contract for initial render and refreshes", async () => {
  const [queuePage, queueRoute, queueApplication] = await Promise.all([
    readFile(new URL("(private)/filas/page.tsx", appRoot), "utf8"),
    readFile(new URL("api/queues/route.ts", appRoot), "utf8"),
    readFile(new URL("../lib/queues/application.ts", appRoot), "utf8"),
  ]);

  assert.match(queuePage, /queueWorkspaceView/);
  assert.match(queueRoute, /queueWorkspaceView/);
  assert.match(queueApplication, /deliveries:\s*item\.deliveries\.map/);
  assert.match(queueApplication, /channels:\s*queue\.targets\.map/);
});

test("keeps WhatsApp QR control server-side and live delivery disabled", async () => {
  const [route, application, manager, worker] = await Promise.all([
    readFile(new URL("api/whatsapp/[action]/route.ts", appRoot), "utf8"),
    readFile(new URL("../lib/whatsapp/application.ts", appRoot), "utf8"),
    readFile(new URL("../components/channels/ChannelManager.tsx", appRoot), "utf8"),
    readFile(new URL("../../worker/src/whatsapp-connector.ts", appRoot), "utf8"),
  ]);
  assert.match(route, /getAuthenticatedAdmin/);
  assert.match(route, /hasValidRequestOrigin/);
  assert.match(application, /WORKER_API_TOKEN/);
  assert.match(application, /QRCode\.toDataURL/);
  assert.doesNotMatch(manager, /WORKER_API_TOKEN|WHATSAPP_SESSION/);
  assert.match(worker, /SEND_LIVE !== "true"/);
  assert.match(worker, /endsWith\("@g\.us"\)/);
});

test("keeps the main dashboard focused on one-click Shopee queueing", async () => {
  const [dashboard, quickOffer, products, operations] = await Promise.all([
    readFile(new URL("../components/dashboard/DashboardView.tsx", appRoot), "utf8"),
    readFile(new URL("../components/dashboard/QuickOfferForm.tsx", appRoot), "utf8"),
    readFile(new URL("../lib/products/application.ts", appRoot), "utf8"),
    readFile(new URL("../../../packages/database/src/repositories/operational-repository.ts", appRoot), "utf8"),
  ]);
  assert.match(dashboard, /Postagens automáticas/);
  assert.match(dashboard, /Ativar automação/);
  assert.match(quickOffer, /Converter e visualizar/);
  assert.match(quickOffer, /Confirmar e colocar na fila/);
  assert.match(quickOffer, /affiliateConfirmed/);
  assert.match(products, /dailyStartTime:\s*"08:00"/);
  assert.match(products, /dailyEndTime:\s*"22:00"/);
  assert.match(products, /intervalMinutes:\s*20/);
  assert.match(operations, /queueItem\.count/);
  assert.match(operations, /"PENDING", "SCHEDULED", "PROCESSING", "PAUSED"/);
});
