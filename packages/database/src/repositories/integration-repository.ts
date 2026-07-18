import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { IntegrationType, type IntegrationStatus, type Prisma, type PrismaClient } from "@prisma/client";

export type IntegrationSecret = Record<string, string>;
export class CredentialCipher {
  private readonly key: Buffer;
  constructor(encodedKey: string) { this.key = Buffer.from(encodedKey, "base64"); if (this.key.length !== 32) throw new Error("APP_ENCRYPTION_KEY deve conter 32 bytes em Base64."); }
  encrypt(value: IntegrationSecret) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.key, iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]); return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join("."); }
  decrypt(value: string): IntegrationSecret { const [version, iv, tag, ciphertext] = value.split("."); if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Credencial criptografada inválida."); const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64")); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8")) as IntegrationSecret; }
}

export class IntegrationRepository {
  constructor(private readonly prisma: PrismaClient) {}
  listSafe() { return this.prisma.integration.findMany({ select: { id: true, type: true, status: true, encryptedCredentials: true, displayName: true, metadata: true, lastConnectionAt: true, lastHeartbeatAt: true, lastError: true, updatedAt: true }, orderBy: { type: "asc" } }); }
  find(type: IntegrationType) { return this.prisma.integration.findUnique({ where: { type } }); }
  async save(input: { type: IntegrationType; status?: IntegrationStatus; displayName?: string; metadata?: Prisma.InputJsonValue; credentials?: IntegrationSecret }, cipher: CredentialCipher) {
    const current = await this.find(input.type); const encryptedCredentials = input.credentials && Object.values(input.credentials).some(Boolean) ? cipher.encrypt(input.credentials) : current?.encryptedCredentials;
    return this.prisma.integration.upsert({ where: { type: input.type }, create: { type: input.type, status: input.status, displayName: input.displayName, metadata: input.metadata, encryptedCredentials }, update: { status: input.status, displayName: input.displayName, metadata: input.metadata, encryptedCredentials } });
  }
  updateStatus(type: IntegrationType, status: IntegrationStatus, data: { lastError?: string | null; lastConnectionAt?: Date; lastHeartbeatAt?: Date } = {}) { return this.prisma.integration.upsert({ where: { type }, create: { type, status, ...data }, update: { status, ...data } }); }
  audit(userId: string | undefined, action: string, integrationId: string, metadata: Prisma.InputJsonValue = {}) { return this.prisma.auditLog.create({ data: { userId, action, entityType: "Integration", entityId: integrationId, metadata } }); }
}
