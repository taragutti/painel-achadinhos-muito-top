import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/", import.meta.url);

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
