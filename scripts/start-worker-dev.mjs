import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environmentPath = resolve(repositoryRoot, ".env");
const workerRoot = resolve(repositoryRoot, "apps/worker");
const tsxCli = resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs");

if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

const child = spawn(process.execPath, [tsxCli, "watch", "src/index.ts"], {
  cwd: workerRoot,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("exit", (code) => {
  process.exitCode = code ?? 0;
});
