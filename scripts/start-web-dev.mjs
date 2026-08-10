import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environmentPath = resolve(repositoryRoot, ".env");
const webRoot = resolve(repositoryRoot, "apps/web");
const nextCli = resolve(repositoryRoot, "node_modules/next/dist/bin/next");

if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

const child = spawn(process.execPath, [nextCli, "dev"], {
  cwd: webRoot,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("exit", (code) => {
  process.exitCode = code ?? 0;
});
