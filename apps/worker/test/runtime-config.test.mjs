import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkerEnvironment } from "../dist/runtime-config.js";

const safeEnvironment = {
  DATABASE_URL:
    "postgresql://fictitious:fictitious@database.invalid:5432/fictitious",
  WORKER_HEALTH_TOKEN: "fictitious-health-token-long",
  WORKER_API_TOKEN: "fictitious-control-token-long",
  PROVIDER_MODE: "mock",
  SEND_LIVE: "false",
  MOCK_PROVIDERS: "true",
  DEMO_MODE: "true",
};

test("accepts a complete mock worker configuration", () => {
  assert.doesNotThrow(() => validateWorkerEnvironment(safeEnvironment));
});

test("reports only invalid variable names and never their values", () => {
  const privateValue = "do-not-expose-this-value";
  assert.throws(
    () =>
      validateWorkerEnvironment({
        ...safeEnvironment,
        DATABASE_URL: privateValue,
        WORKER_HEALTH_TOKEN: privateValue.slice(0, 5),
      }),
    (error) => {
      assert.match(error.message, /DATABASE_URL/);
      assert.match(error.message, /WORKER_HEALTH_TOKEN/);
      assert.doesNotMatch(error.message, new RegExp(privateValue));
      return true;
    },
  );
});

test("rejects partial or contradictory live activation", () => {
  assert.throws(
    () =>
      validateWorkerEnvironment({
        ...safeEnvironment,
        SEND_LIVE: "true",
        PROVIDER_MODE: "mock",
        MOCK_PROVIDERS: "true",
        DEMO_MODE: "true",
      }),
    /DEMO_MODE.*MOCK_PROVIDERS.*PROVIDER_MODE.*TELEGRAM_ENABLED ou WHATSAPP_ENABLED/,
  );
});

test("accepts explicit live activation only with an enabled configured provider", () => {
  assert.doesNotThrow(() =>
    validateWorkerEnvironment({
      ...safeEnvironment,
      SEND_LIVE: "true",
      PROVIDER_MODE: "live",
      MOCK_PROVIDERS: "false",
      DEMO_MODE: "false",
      WHATSAPP_ENABLED: "true",
      WHATSAPP_SESSION_DIR: "/var/lib/achadinhos/whatsapp-session",
    }),
  );
});
