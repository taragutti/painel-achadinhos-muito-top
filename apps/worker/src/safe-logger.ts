import type { SafeLogger } from "@achadinhos/providers";
function write(level: "info" | "warn" | "error", event: string, metadata: Readonly<Record<string, unknown>> = {}) { console[level](JSON.stringify({ level, event, ...metadata, timestamp: new Date().toISOString() })); }
export const safeLogger: SafeLogger = { info: (event, metadata) => write("info", event, metadata), warn: (event, metadata) => write("warn", event, metadata), error: (event, metadata) => write("error", event, metadata) };
