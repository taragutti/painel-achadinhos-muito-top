import assert from "node:assert/strict";
import test from "node:test";
import { startHealthServer } from "../dist/health-server.js";

test("worker health is private and exposes only safe operational metrics", async (t) => {
  const state = {
    runId: "run-test",
    startedAt: new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
    lastProcessingAt: new Date().toISOString(),
    processed: 3,
    succeeded: 2,
    failed: 1,
  };
  const whatsapp = {
    getStatus: async () => ({ platform: "WHATSAPP", state: "WAITING_QR", configured: false }),
    getQrCode: async () => ({ value: "temporary-qr-value", expiresAt: new Date(Date.now() + 60_000) }),
    getSelectedGroup: () => null,
    connect: async () => undefined,
    listGroups: async () => [],
    selectGroup: async () => undefined,
    disconnect: async () => undefined,
    revokeSession: async () => undefined,
  };
  const healthToken = "fictitious-health-token-long";
  const controlToken = "fictitious-control-token-long";
  const server = startHealthServer(state, healthToken, controlToken, whatsapp, 0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/health`;

  assert.equal((await fetch(endpoint)).status, 401);
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${healthToken}` },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.runId, "run-test");
  assert.deepEqual(body.metrics, { processed: 3, succeeded: 2, failed: 1 });
  assert.doesNotMatch(JSON.stringify(body), /token|authorization|session/i);

  const statusEndpoint = `http://127.0.0.1:${address.port}/control/whatsapp/status`;
  assert.equal((await fetch(statusEndpoint)).status, 401);
  const statusResponse = await fetch(statusEndpoint, {
    headers: { authorization: `Bearer ${controlToken}` },
  });
  assert.equal(statusResponse.status, 200);
  const statusBody = await statusResponse.json();
  assert.equal(statusBody.status.state, "WAITING_QR");
  assert.equal(statusBody.qr.value, "temporary-qr-value");
});
