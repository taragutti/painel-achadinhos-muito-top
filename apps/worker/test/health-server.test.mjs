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
  const server = startHealthServer(state, "fictitious-health-token", 0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/health`;

  assert.equal((await fetch(endpoint)).status, 401);
  const response = await fetch(endpoint, {
    headers: { authorization: "Bearer fictitious-health-token" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.runId, "run-test");
  assert.deepEqual(body.metrics, { processed: 3, succeeded: 2, failed: 1 });
  assert.doesNotMatch(JSON.stringify(body), /token|authorization|session/i);
});
