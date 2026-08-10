import type { SafeLogger } from "@achadinhos/providers";

type ConsoleLevel = "log" | "info" | "warn" | "error";
type ConsoleMethod = (...values: unknown[]) => void;

let consoleGuardInstalled = false;

export function installSafeConsoleGuard(): void {
  if (consoleGuardInstalled) return;
  consoleGuardInstalled = true;

  for (const level of ["log", "info", "warn", "error"] as const) {
    const original = console[level].bind(console) as ConsoleMethod;
    console[level] = (...values: unknown[]) => {
      if (isStructuredSafeLog(values)) {
        original(values[0]);
        return;
      }
      original(
        JSON.stringify({
          level: level === "log" ? "info" : level,
          event: "runtime.unstructured_log.suppressed",
          originalLevel: level,
          timestamp: new Date().toISOString(),
        }),
      );
    };
  }
}

export function isStructuredSafeLog(values: readonly unknown[]): boolean {
  if (values.length !== 1 || typeof values[0] !== "string") return false;
  try {
    const parsed = JSON.parse(values[0]) as Record<string, unknown>;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.level === "string" &&
      typeof parsed.event === "string" &&
      typeof parsed.timestamp === "string"
    );
  } catch {
    return false;
  }
}

function write(
  level: "info" | "warn" | "error",
  event: string,
  metadata: Readonly<Record<string, unknown>> = {},
): void {
  console[level](
    JSON.stringify({
      level,
      event,
      ...metadata,
      timestamp: new Date().toISOString(),
    }),
  );
}

export const safeLogger: SafeLogger = {
  info: (event, metadata) => write("info", event, metadata),
  warn: (event, metadata) => write("warn", event, metadata),
  error: (event, metadata) => write("error", event, metadata),
};
