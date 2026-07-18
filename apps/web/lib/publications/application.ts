import { getPrisma, PublicationRepository, PublicationService, QueueRepository, QueueService, TemplateRepository } from "@achadinhos/database";
import { sanitizeMessageText, validateProviderMessage } from "@achadinhos/shared";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export async function listPublications() { await requireAuthenticatedAdmin(); return new PublicationRepository(getPrisma()).listCurrent(); }
export async function getPublication(id: string) { await requireAuthenticatedAdmin(); return new PublicationRepository(getPrisma()).findById(id); }
export async function listTemplates() { await requireAuthenticatedAdmin(); return new TemplateRepository(getPrisma()).listAll(); }
export async function listActiveTemplates() { await requireAuthenticatedAdmin(); return new TemplateRepository(getPrisma()).listActive(); }

export async function createComposedPublication(input: {
  type: "ART_LINK" | "FREE_TEXT"; title?: string; customMessage: string; destinationLink?: string;
  mediaUrl?: string; couponCode?: string; category?: "SIMPLE" | "LINK" | "NOTICE" | "COUPON" | "INVITATION" | "GROUP_RULES";
  platforms: Array<"WHATSAPP" | "TELEGRAM">; templateId?: string; intent: "DRAFT" | "QUEUE";
}) {
  let finalText = sanitizeMessageText(input.customMessage).trim();
  if (input.couponCode && !finalText.includes(input.couponCode)) finalText += `\n\n🎟️ Cupom: ${sanitizeMessageText(input.couponCode)}`;
  if (input.destinationLink && !finalText.includes(input.destinationLink)) finalText += `\n\n${input.destinationLink}`;
  const validations = input.platforms.map((platform) => ({ platform, ...validateProviderMessage(finalText, platform, Boolean(input.mediaUrl)) }));
  if (validations.some((validation) => !validation.valid)) throw new Error("MESSAGE_LENGTH_INVALID");
  const prisma = getPrisma();
  const publication = await new PublicationService(new PublicationRepository(prisma)).create({ ...input, customMessage: finalText, metadata: { validations: validations.map((item) => `${item.platform}:${item.characters}/${item.maximum}`) } });
  if (input.intent === "DRAFT") return { publication, queued: false };
  const queue = await prisma.publishingQueue.findFirst({ where: { status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { createdAt: "asc" } });
  if (!queue) return { publication, queued: false, warning: "Publicação salva, mas nenhuma fila está configurada." };
  const item = await new QueueService(new QueueRepository(prisma)).enqueue(queue.id, publication.id);
  return { publication, item, queued: true };
}
