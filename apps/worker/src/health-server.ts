import { createServer, type Server } from "node:http";
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
  token: string | undefined,
  port = 9464,
  host = "127.0.0.1",
): Server {
  return createServer((request, response) => {
    if (request.url !== "/health") {
      response.writeHead(404).end();
      return;
    }
    const authorization = request.headers.authorization;
    if (!token || authorization !== `Bearer ${token}`) {
      response
        .writeHead(401, { "content-type": "application/json" })
        .end(JSON.stringify({ status: "unauthorized" }));
      return;
    }
    const heartbeatAge = Date.now() - new Date(state.lastHeartbeatAt).getTime();
    const healthy = heartbeatAge < 120000;
    response
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
  }).listen(port, host);
}
