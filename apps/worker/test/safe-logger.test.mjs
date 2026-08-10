import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { isStructuredSafeLog } from "../dist/safe-logger.js";

test("accepts only one structured safe log value", () => {
  const structured = JSON.stringify({
    level: "info",
    event: "worker.started",
    timestamp: new Date(0).toISOString(),
  });

  assert.equal(isStructuredSafeLog([structured]), true);
  assert.equal(isStructuredSafeLog(["Closing session:", { privateKey: "secret" }]), false);
  assert.equal(isStructuredSafeLog(["plain text"]), false);
});

test("suppresses dependency output without exposing its values", () => {
  const moduleUrl = new URL("../dist/safe-logger.js", import.meta.url).href;
  const privateValue = "private-session-material";
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { installSafeConsoleGuard } from ${JSON.stringify(moduleUrl)}; installSafeConsoleGuard(); console.warn("Closing session:", { privateKey: ${JSON.stringify(privateValue)} });`,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, new RegExp(privateValue));
  assert.match(result.stderr, /runtime\.unstructured_log\.suppressed/);
});
