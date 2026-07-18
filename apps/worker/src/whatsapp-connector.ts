import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import type { AvailableChannel, HealthResult, ProviderStatus, SendInput, SendResult, WhatsAppConnector } from "@achadinhos/providers";

// Transport-neutral session shell. A future WhatsApp client plugs in here; it is never imported by apps/web.
export class WorkerWhatsAppConnector implements WhatsAppConnector {
  private state: ProviderStatus["state"] = "DISCONNECTED"; private qr: { value: string; expiresAt: Date } | null = null;
  constructor(private readonly sessionDirectory: string, private readonly allowedGroupId: string) {}
  async connect() { await mkdir(resolve(this.sessionDirectory), { recursive: true }); const session = await this.readSession(); if (session) { this.state = "CONNECTING"; return; } this.state = "WAITING_QR"; this.qr = { value: `whatsapp-qr:${randomBytes(24).toString("base64url")}`, expiresAt: new Date(Date.now() + 60_000) }; }
  async disconnect() { this.state = "DISCONNECTED"; this.qr = null; }
  async revokeSession() { await this.disconnect(); await rm(resolve(this.sessionDirectory, "session-state.json"), { force: true }); }
  async getStatus(): Promise<ProviderStatus> { return { platform: "WHATSAPP", state: this.state, configured: Boolean(this.allowedGroupId), lastHeartbeatAt: new Date() }; }
  async getQrCode() { if (this.qr && this.qr.expiresAt <= new Date()) this.qr = null; return this.qr; }
  async listGroups(): Promise<AvailableChannel[]> { return this.allowedGroupId ? [{ externalId: this.allowedGroupId, name: "Grupo autorizado", kind: "GROUP" }] : []; }
  async sendText(_input: SendInput): Promise<SendResult> { throw new Error("Cliente WhatsApp concreto ainda não configurado."); }
  async sendImage(_input: SendInput & { imageUrl: string }): Promise<SendResult> { throw new Error("Cliente WhatsApp concreto ainda não configurado."); }
  async healthCheck(): Promise<HealthResult> { return { healthy: this.state === "CONNECTED", checkedAt: new Date(), detail: this.state === "CONNECTED" ? "Conectado." : "Cliente desconectado." }; }
  async persistSessionMarker() { await mkdir(resolve(this.sessionDirectory), { recursive: true }); await writeFile(resolve(this.sessionDirectory, "session-state.json"), JSON.stringify({ connected: true, updatedAt: new Date().toISOString() }), { mode: 0o600 }); }
  private async readSession() { try { return JSON.parse(await readFile(resolve(this.sessionDirectory, "session-state.json"), "utf8")) as { connected: boolean }; } catch { return null; } }
}
