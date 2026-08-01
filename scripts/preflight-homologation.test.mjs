import assert from "node:assert/strict";
import test from "node:test";
import {
  checkHomologation,
  formatPreflight,
} from "./preflight-homologation.mjs";

const fictitiousEnvironment = {
  DATABASE_URL:
    "postgresql://homolog_user:local_password@localhost:5432/achadinhos_homolog",
  ADMIN_EMAIL: "admin@homologation.test",
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_HEALTH_TOKEN: "test-only-app-health-token-001",
  WORKER_HEALTH_TOKEN: "test-only-worker-health-token-002",
  WORKER_API_TOKEN: "test-only-worker-control-token-003",
  APP_URL: "http://localhost:3000",
  WORKER_API_URL: "http://127.0.0.1:9464",
  SHOPEE_API_BASE_URL:
    "https://open-api.affiliate.shopee.com.br/graphql",
  SHOPEE_APP_ID: "test-only-app-id",
  SHOPEE_APP_SECRET: "test-only-app-secret",
  SHOPEE_AFFILIATE_ID: "test-only-affiliate-id",
  DEMO_MODE: "true",
  PROVIDER_MODE: "mock",
  MOCK_PROVIDERS: "true",
  SEND_LIVE: "false",
  WHATSAPP_ENABLED: "false",
  MOCK_PROVIDER_BEHAVIOR: "SUCCESS",
};

test("approves a complete local homologation configuration", () => {
  const result = formatPreflight(
    checkHomologation(fictitiousEnvironment),
  );
  assert.equal(result.failures, 0);
  assert.equal(result.warnings, 0);
});

test("fails closed for incomplete live-like flags", () => {
  const result = formatPreflight(
    checkHomologation({
      ...fictitiousEnvironment,
      PROVIDER_MODE: "live",
      SEND_LIVE: "true",
      SHOPEE_APP_ID: "",
      SHOPEE_APP_SECRET: "",
      SHOPEE_AFFILIATE_ID: "",
    }),
  );
  assert.ok(result.failures >= 5);
  assert.match(result.output, /PROVIDER_MODE=mock/);
  assert.match(result.output, /SEND_LIVE=false/);
});

test("allows mock homologation without live Shopee credentials", () => {
  const result = formatPreflight(
    checkHomologation({
      ...fictitiousEnvironment,
      SHOPEE_APP_ID: "",
      SHOPEE_APP_SECRET: "",
      SHOPEE_AFFILIATE_ID: "",
    }),
  );
  assert.equal(result.failures, 0);
});

test("never prints environment values", () => {
  const privateValue = "fictitious-private-value-never-print";
  const result = formatPreflight(
    checkHomologation({
      ...fictitiousEnvironment,
      DATABASE_URL: privateValue,
      SHOPEE_APP_SECRET: privateValue,
    }),
  );
  assert.doesNotMatch(result.output, new RegExp(privateValue));
  assert.match(result.output, /DATABASE_URL PostgreSQL configurada/);
});

test("rejects the committed example placeholders", () => {
  const result = formatPreflight(
    checkHomologation({
      ...fictitiousEnvironment,
      DATABASE_URL:
        "postgresql://example_user:example_password@localhost:5432/achadinhos_example",
      ADMIN_EMAIL: "admin@example.invalid",
      APP_ENCRYPTION_KEY:
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      APP_HEALTH_TOKEN: "replace_with_random_health_token",
      WORKER_API_URL: "https://worker.example.invalid",
      SHOPEE_APP_ID: "example_shopee_app_id",
      SHOPEE_APP_SECRET: "example_shopee_app_secret",
      SHOPEE_AFFILIATE_ID: "example_shopee_affiliate_id",
      DEMO_MODE: "false",
      PROVIDER_MODE: "live",
      MOCK_PROVIDERS: "false",
      SEND_LIVE: "true",
    }),
  );
  assert.ok(result.failures >= 8);
});
