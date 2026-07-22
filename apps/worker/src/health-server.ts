import { createServer, type Server } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { AvailableChannel, ProviderStatus } from "@achadinhos/providers";
export type WhatsAppControl = {
  getStatus(): Promise<ProviderStatus>;
  getQrCode(): Promise<{ value: string; expiresAt: Date } | null>;
  getSelectedGroup(): { groupId: string; groupName: string } | null;
  connect(): Promise<void>;
  listGroups(): Promise<AvailableChannel[]>;
  selectGroup(groupId: string, groupName: string): Promise<void>;
  disconnect(): Promise<void>;
  revokeSession(): Promise<void>;
};
export type WorkerHealthState = {
  runId: string;
  startedAt: string;
  lastHeartbeatAt: string;
  lastProcessingAt?: string;
  processed: number;
  succeeded: number;
  failed: number;
  lastError?: string;
};
export function startHealthServer(
  state: WorkerHealthState,
  healthToken: string | undefined,
  controlToken: string | undefined,
  whatsapp: WhatsAppControl,
  port = 9464,
  host = "127.0.0.1",
): Server {
  return createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (request.url === "/health") {
      if (!isAuthorized(request.headers.authorization, healthToken)) return unauthorized(response);
      return healthResponse(response, state);
    }
    if (!request.url?.startsWith("/control/whatsapp")) return response.writeHead(404).end();
    if (!isAuthorized(request.headers.authorization, controlToken)) return unauthorized(response);
    try {
      if (request.method === "GET" && request.url === "/control/whatsapp/status") {
        const status = await whatsapp.getStatus();
        const qr = await whatsapp.getQrCode();
        return response.writeHead(200).end(JSON.stringify({
          status: { ...status, lastHeartbeatAt: status.lastHeartbeatAt?.toISOString() },
          qr: qr ? { value: qr.value, expiresAt: qr.expiresAt.toISOString() } : null,
          selectedGroup: whatsapp.getSelectedGroup(),
        }));
      }
      if (request.method === "POST" && request.url === "/control/whatsapp/connect") {
        await whatsapp.connect();
        return response.writeHead(202).end(JSON.stringify({ status: "connecting" }));
      }
      if (request.method === "GET" && request.url === "/control/whatsapp/groups") {
        return response.writeHead(200).end(JSON.stringify({ groups: await whatsapp.listGroups() }));
      }
      if (request.method === "POST" && request.url === "/control/whatsapp/select-group") {
        const body = await readJsonBody(request);
        if (typeof body.groupId !== "string" || typeof body.groupName !== "string") {
          return response.writeHead(400).end(JSON.stringify({ error: "Grupo inválido." }));
        }
        await whatsapp.selectGroup(body.groupId, body.groupName);
        return response.writeHead(200).end(JSON.stringify({ status: "selected" }));
      }
      if (request.method === "POST" && request.url === "/control/whatsapp/disconnect") {
        await whatsapp.disconnect();
        return response.writeHead(200).end(JSON.stringify({ status: "disconnected" }));
      }
      if (request.method === "POST" && request.url === "/control/whatsapp/revoke") {
        await whatsapp.revokeSession();
        return response.writeHead(200).end(JSON.stringify({ status: "revoked" }));
      }
      return response.writeHead(404).end();
    } catch (error) {
      return response.writeHead(400).end(JSON.stringify({
        error: error instanceof Error ? error.message.slice(0, 200) : "Falha no controle do WhatsApp.",
      }));
    }
  }).listen(port, host);
}

function healthResponse(response: import("node:http").ServerResponse, state: WorkerHealthState) {
    const heartbeatAge = Date.now() - new Date(state.lastHeartbeatAt).getTime();
    const healthy = heartbeatAge < 120000;
    return response
      .writeHead(healthy ? 200 : 503, {
        "content-type": "application/json",
        "cache-control": "no-store",
      })
      .end(
        JSON.stringify({
          status: healthy ? "ok" : "stale",
          runId: state.runId,
          startedAt: state.startedAt,
          lastHeartbeatAt: state.lastHeartbeatAt,
          lastProcessingAt: state.lastProcessingAt,
          metrics: {
            processed: state.processed,
            succeeded: state.succeeded,
            failed: state.failed,
          },
        }),
      );
}

function unauthorized(response: import("node:http").ServerResponse) {
  return response.writeHead(401).end(JSON.stringify({ status: "unauthorized" }));
}

function isAuthorized(authorization: string | undefined, token: string | undefined): boolean {
  if (!authorization || !token || token.length < 24) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(authorization);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 16_384) throw new Error("Requisição muito grande.");
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("Requisição inválida.");
  }
}
