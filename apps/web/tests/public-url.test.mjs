import assert from "node:assert/strict";
import test from "node:test";
import { getPublicAppUrl } from "../lib/runtime/public-url.ts";

test("prefers an explicit canonical HTTPS URL", () => {
  assert.equal(
    getPublicAppUrl({
      APP_URL: "https://painel.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "project.vercel.app",
      VERCEL_URL: "preview.vercel.app",
    }).href,
    "https://painel.example.com/",
  );
});

test("replaces a loopback APP_URL with the stable Vercel production URL", () => {
  assert.equal(
    getPublicAppUrl({
      APP_URL: "http://localhost:3000",
      VERCEL_PROJECT_PRODUCTION_URL: "project.vercel.app",
      VERCEL_URL: "preview.vercel.app",
    }).href,
    "https://project.vercel.app/",
  );
});

test("uses the deployment URL when the stable project URL is unavailable", () => {
  assert.equal(
    getPublicAppUrl({
      APP_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: "preview.vercel.app",
    }).href,
    "https://preview.vercel.app/",
  );
});

test("keeps localhost as the development fallback", () => {
  assert.equal(
    getPublicAppUrl({
      APP_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
    }).href,
    "http://localhost:3000/",
  );
});
