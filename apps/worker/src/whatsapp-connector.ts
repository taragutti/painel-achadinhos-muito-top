import {
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import type {
  AvailableChannel,
  HealthResult,
  ProviderStatus,
  SendInput,
  SendResult,
  WhatsAppConnector,
} from "@achadinhos/providers";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pino from "pino";
import { safeLogger } from "./safe-logger.js";

type StoredSelection = { groupId: string; groupName: string };

export class WorkerWhatsAppConnector implements WhatsAppConnector {
  private socket: WASocket | null = null;
  private state: ProviderStatus["state"] = "DISCONNECTED";
  private qr: { value: string; expiresAt: Date } | null = null;
  private lastError: string | undefined;
  private lastHeartbeatAt: Date | undefined;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private selectedGroup: StoredSelection | null = null;
  private starting: Promise<void> | null = null;

  constructor(
    private readonly sessionDirectory: string,
    initialAllowedGroupId = "",
  ) {
    if (initialAllowedGroupId.endsWith("@g.us")) {
      this.selectedGroup = {
        groupId: initialAllowedGroupId,
        groupName: "Grupo autorizado",
      };
    }
  }

  async connect(): Promise<void> {
    if (process.env.WHATSAPP_ENABLED !== "true") {
      throw new Error("WhatsApp ainda não foi habilitado no worker.");
    }
    if (this.socket || this.starting) return this.starting ?? Promise.resolve();
    this.starting = this.startSocket();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async disconnect(): Promise<void> {
    this.cancelReconnect();
    this.socket?.end(undefined);
    this.socket = null;
    this.qr = null;
    this.state = "DISCONNECTED";
  }

  async revokeSession(): Promise<void> {
    this.cancelReconnect();
    const socket = this.socket;
    this.socket = null;
    if (socket) await socket.logout().catch(() => socket.end(undefined));
    this.qr = null;
    this.selectedGroup = null;
    this.state = "DISCONNECTED";
    await rm(resolve(this.sessionDirectory), { recursive: true, force: true });
  }

  async getStatus(): Promise<ProviderStatus> {
    await this.loadSelection();
    return {
      platform: "WHATSAPP",
      state: this.state,
      configured: Boolean(this.selectedGroup),
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastError: this.lastError,
    };
  }

  async getQrCode() {
    if (this.qr && this.qr.expiresAt.getTime() <= Date.now()) this.qr = null;
    return this.qr;
  }

  async listGroups(): Promise<AvailableChannel[]> {
    if (this.state !== "CONNECTED" || !this.socket) return [];
    const groups = await this.socket.groupFetchAllParticipating();
    return Object.values(groups)
      .map((group) => ({
        externalId: group.id,
        name: group.subject || "Grupo sem nome",
        kind: "GROUP" as const,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }

  async selectGroup(groupId: string, groupName: string): Promise<void> {
    if (!groupId.endsWith("@g.us")) throw new Error("Selecione um grupo válido.");
    const available = await this.listGroups();
    if (!available.some((group) => group.externalId === groupId)) {
      throw new Error("Esse grupo não pertence à conta conectada.");
    }
    this.selectedGroup = { groupId, groupName: groupName.slice(0, 120) };
    await mkdir(resolve(this.sessionDirectory), { recursive: true, mode: 0o700 });
    await writeFile(
      this.selectionPath,
      JSON.stringify(this.selectedGroup),
      { mode: 0o600 },
    );
  }

  getSelectedGroup(): StoredSelection | null {
    return this.selectedGroup;
  }

  async sendText(input: SendInput): Promise<SendResult> {
    this.assertLiveDestination(input.destination);
    const result = await this.socket!.sendMessage(input.destination, { text: input.text });
    return { success: true, providerMessageId: result?.key.id ?? undefined };
  }

  async sendImage(input: SendInput & { imageUrl: string }): Promise<SendResult> {
    this.assertLiveDestination(input.destination);
    const result = await this.socket!.sendMessage(input.destination, {
      image: { url: input.imageUrl },
      caption: input.text,
    });
    return { success: true, providerMessageId: result?.key.id ?? undefined };
  }

  async healthCheck(): Promise<HealthResult> {
    return {
      healthy: this.state === "CONNECTED",
      checkedAt: new Date(),
      detail: this.state === "CONNECTED" ? "Conectado." : "Cliente desconectado.",
    };
  }

  private async startSocket(): Promise<void> {
    await mkdir(resolve(this.sessionDirectory), { recursive: true, mode: 0o700 });
    await this.loadSelection();
    const { state, saveCreds } = await useMultiFileAuthState(resolve(this.sessionDirectory));
    this.state = "CONNECTING";
    this.lastError = undefined;
    const socket = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    this.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
      if (socket !== this.socket) return;
      if (update.qr) {
        this.qr = { value: update.qr, expiresAt: new Date(Date.now() + 60_000) };
        this.state = "WAITING_QR";
      }
      if (update.connection === "connecting" && !update.qr) this.state = "CONNECTING";
      if (update.connection === "open") {
        this.qr = null;
        this.state = "CONNECTED";
        this.lastHeartbeatAt = new Date();
        safeLogger.info("whatsapp.connected");
      }
      if (update.connection === "close") this.handleClose(socket, update.lastDisconnect?.error);
    });
  }

  private handleClose(socket: WASocket, error: unknown): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.qr = null;
    const statusCode = this.disconnectStatus(error);
    const loggedOut = statusCode === DisconnectReason.loggedOut;
    this.state = loggedOut ? "DISCONNECTED" : "ERROR";
    this.lastError = loggedOut ? "Sessão revogada pelo WhatsApp." : "Conexão interrompida.";
    safeLogger.warn("whatsapp.disconnected", { statusCode: statusCode ?? "unknown" });
    if (!loggedOut) {
      this.cancelReconnect();
      this.reconnectTimer = setTimeout(() => void this.connect(), 5_000);
    }
  }

  private disconnectStatus(error: unknown): number | undefined {
    if (!error || typeof error !== "object") return undefined;
    const candidate = error as {
      output?: { statusCode?: number };
      statusCode?: number;
    };
    return candidate.output?.statusCode ?? candidate.statusCode;
  }

  private assertLiveDestination(destination: string): void {
    if (process.env.SEND_LIVE !== "true") {
      throw new Error("Envio real desativado por SEND_LIVE.");
    }
    if (!this.socket || this.state !== "CONNECTED") throw new Error("WhatsApp desconectado.");
    if (!this.selectedGroup || destination !== this.selectedGroup.groupId || !destination.endsWith("@g.us")) {
      throw new Error("Destino do WhatsApp não autorizado.");
    }
  }

  private async loadSelection(): Promise<void> {
    if (this.selectedGroup) return;
    try {
      const value = JSON.parse(await readFile(this.selectionPath, "utf8")) as StoredSelection;
      if (value.groupId.endsWith("@g.us")) this.selectedGroup = value;
    } catch {
      // No group has been selected yet.
    }
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private get selectionPath(): string {
    return resolve(this.sessionDirectory, "selected-group.json");
  }
}
