import { z } from "zod";

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  password: z.string().min(12, "A senha deve ter pelo menos 12 caracteres.").max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const marketplaceSchema = z.enum(["SHOPEE", "MERCADO_LIVRE", "OTHER"]);
const optionalMoneySchema = z.union([z.string().regex(/^\d{1,10}([.,]\d{1,2})?$/), z.literal("")]).optional();
const optionalHttpUrlSchema = z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional();

export const productImportInputSchema = z.object({
  url: z.url({ protocol: /^https?$/ }).max(2048),
});

export const productSaveInputSchema = z.object({
  marketplace: marketplaceSchema,
  sourceUrl: z.url({ protocol: /^https?$/ }).max(2048),
  resolvedUrl: z.url({ protocol: /^https?$/ }).max(2048),
  affiliateUrl: z.url({ protocol: /^https?$/ }).max(2048),
  affiliateConfirmed: z.boolean(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).default(""),
  oldPrice: optionalMoneySchema,
  currentPrice: optionalMoneySchema,
  couponCode: z.string().trim().max(100).optional(),
  storeName: z.string().trim().max(200).optional(),
  originalImageUrl: optionalHttpUrlSchema,
  storedImageUrl: optionalHttpUrlSchema,
  thumbnailImageUrl: optionalHttpUrlSchema,
  internalNotes: z.string().trim().max(2000).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
});

export type ProductImportInput = z.infer<typeof productImportInputSchema>;
export type ProductSaveInput = z.infer<typeof productSaveInputSchema>;

export const templateVariables = ["titulo", "descricao", "precoAtual", "precoAnterior", "desconto", "cupom", "link", "loja", "marketplace"] as const;
export type TemplateVariable = typeof templateVariables[number];
export type TemplateValues = Partial<Record<TemplateVariable, string>>;
export const DEFAULT_PRODUCT_TEMPLATE = `🔥 *{{titulo}}*

{{#precoAnterior}}
De: ~R$ {{precoAnterior}}~
{{/precoAnterior}}

{{#precoAtual}}
💰 Por: *R$ {{precoAtual}}*
{{/precoAtual}}

{{#cupom}}
🎟️ Cupom: *{{cupom}}*
{{/cupom}}

🛒 Confira:
{{link}}

⚠️ Preço e estoque podem mudar sem aviso.`;

export function renderMessageTemplate(template: string, values: TemplateValues) {
  const sanitizedTemplate = sanitizeMessageText(template);
  const missing = new Set<TemplateVariable>();
  let output = sanitizedTemplate.replace(/{{#([a-zA-Z]+)}}([\s\S]*?){{\/\1}}/g, (_match, rawName: string, body: string) => {
    const name = rawName as TemplateVariable;
    if (!templateVariables.includes(name) || !values[name]) { if (templateVariables.includes(name)) missing.add(name); return ""; }
    return body;
  });
  output = output.replace(/{{([^{}#\/]+)}}/g, (_match, rawName: string) => {
    const name = rawName.trim() as TemplateVariable;
    if (!templateVariables.includes(name)) return "";
    const value = values[name]; if (!value) { missing.add(name); return ""; }
    return sanitizeTemplateValue(value);
  });
  output = output.replace(/{{[\s\S]*?}}/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return { text: output, missingFields: [...missing] };
}

export function validateProviderMessage(text: string, platform: "WHATSAPP" | "TELEGRAM", hasMedia = false) {
  const maximum = platform === "TELEGRAM" && hasMedia ? 1024 : 4096;
  return { valid: text.length > 0 && text.length <= maximum, characters: text.length, maximum };
}

export function sanitizeMessageText(value: string) { return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, 12000); }
function sanitizeTemplateValue(value: string) { return sanitizeMessageText(value).replace(/{{|}}/g, ""); }

export const publicationComposerSchema = z.object({
  type: z.enum(["ART_LINK", "FREE_TEXT"]),
  title: z.string().trim().max(300).optional(),
  customMessage: z.string().trim().min(1).max(12000),
  destinationLink: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
  mediaUrl: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
  couponCode: z.string().trim().max(100).optional(),
  category: z.enum(["SIMPLE", "LINK", "NOTICE", "COUPON", "INVITATION", "GROUP_RULES"]).optional(),
  platforms: z.array(z.enum(["WHATSAPP", "TELEGRAM"])).min(1),
  templateId: z.string().optional(),
  intent: z.enum(["DRAFT", "QUEUE"]),
});

export const messageTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(["WHATSAPP", "TELEGRAM", "BOTH"]),
  content: z.string().trim().min(1).max(12000),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const channelSchema = z.enum(["telegram", "whatsapp", "mock"]);
export type Channel = z.infer<typeof channelSchema>;

export const publicationPayloadSchema = z.object({
  publicationId: z.string().min(1),
  idempotencyKey: z.string().min(16).max(128),
  destination: z.string().min(1),
  text: z.string().min(1).max(4096),
  link: z.url().optional(),
});
export type PublicationPayload = z.infer<typeof publicationPayloadSchema>;

export const liveDeliveryEnabled = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
) =>
  environment.SEND_LIVE === "true";

export type PublicationResult = {
  success: boolean;
  externalId?: string;
  detail?: string;
};

export interface PublicationProvider {
  readonly name: string;
  publish(payload: PublicationPayload): Promise<PublicationResult>;
}

export const integrationUpdateSchema = z.object({
  type: z.enum(["TELEGRAM", "WHATSAPP"]),
  displayName: z.string().trim().max(160).optional(),
  secret: z.string().trim().max(500).optional(),
  groupId: z.string().trim().max(200).optional(),
  enabled: z.boolean(),
});
export const integrationActionSchema = z.object({ type: z.enum(["TELEGRAM", "WHATSAPP"]), action: z.enum(["CONNECT", "DISCONNECT", "REVOKE", "TEST"]) });

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const queueInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channelIds: z.array(z.string().min(1)).min(1),
  startsAt: z.iso.datetime().optional(),
  dailyStartTime: timeSchema.optional(),
  dailyEndTime: timeSchema.optional(),
  itemsPerBatch: z.number().int().min(1).max(10),
  intervalMinutes: z.number().int().min(1).max(10080),
  secondsBetweenItems: z.number().int().min(1).max(3600),
  repeatEnabled: z.boolean(),
  repeatCooldownHours: z.number().int().min(1).max(8760),
});
export const queueItemInputSchema = z.object({ publicationId: z.string().min(1), priority: z.number().int().min(-100).max(100).default(0) });
export const queueActionSchema = z.object({ action: z.enum(["START", "PAUSE", "RESUME", "COMPLETE", "CLEAR_PENDING", "RETRY_ITEM", "PAUSE_ITEM", "REMOVE_ITEM", "DUPLICATE_ITEM", "SET_PRIORITY", "REORDER"]), itemId: z.string().optional(), priority: z.number().int().min(-100).max(100).optional(), orderedItemIds: z.array(z.string()).optional() });

export function calculateNextDailyWindow(now: Date, startTime: string | null | undefined, endTime: string | null | undefined, timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const currentMinutes = get("hour") * 60 + get("minute"); const parse = (value?: string | null) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
  const start = parse(startTime); const end = parse(endTime); const inside = start !== null && end !== null && start > end ? currentMinutes >= start || currentMinutes <= end : (start === null || currentMinutes >= start) && (end === null || currentMinutes <= end); return { inside, currentMinutes, startMinutes: start, endMinutes: end };
}
export function nextAllowedTime(now: Date, startTime: string | null | undefined, endTime: string | null | undefined, timeZone = "America/Sao_Paulo") { if (calculateNextDailyWindow(now, startTime, endTime, timeZone).inside) return now; for (let minutes = 1; minutes <= 48 * 60; minutes++) { const candidate = new Date(now.getTime() + minutes * 60000); if (calculateNextDailyWindow(candidate, startTime, endTime, timeZone).inside) return candidate; } throw new Error("Daily publishing window could not be resolved"); }
export function retryBackoffMinutes(attemptNumber: number) { return [1, 5, 15][Math.min(Math.max(attemptNumber, 1) - 1, 2)]; }
export function selectBatchWithoutConsecutiveProducts<T extends { productId: string | null }>(items: T[], maximum: number) { const selected: T[] = []; let lastProductId: string | null = null; for (const item of items) { if (selected.length >= maximum) break; if (lastProductId && item.productId === lastProductId) continue; selected.push(item); lastProductId = item.productId; } return selected; }
export function summarizeDeliveryChannels(channelIds: string[], deliveries: Array<{ channelId: string; status: "SENT" | "FAILED" | "PROCESSING"; attemptNumber: number }>, maximumAttempts = 3) { const pending = channelIds.filter((channelId) => !deliveries.some((delivery) => delivery.channelId === channelId && delivery.status === "SENT")); return { complete: pending.length === 0, retryChannelIds: pending.filter((channelId) => Math.max(0, ...deliveries.filter((delivery) => delivery.channelId === channelId).map((delivery) => delivery.attemptNumber)) < maximumAttempts), exhaustedChannelIds: pending.filter((channelId) => Math.max(0, ...deliveries.filter((delivery) => delivery.channelId === channelId).map((delivery) => delivery.attemptNumber)) >= maximumAttempts) }; }
export const operationalSettingsSchema = z.object({ panelName: z.string().trim().min(1).max(100), timezone: z.literal("America/Sao_Paulo"), defaultIntervalMinutes: z.number().int().min(1).max(10080), defaultItemsPerBatch: z.number().int().min(1).max(10), defaultSecondsBetweenItems: z.number().int().min(1).max(3600), dailyStartTime: timeSchema, dailyEndTime: timeSchema, repeatEnabled: z.boolean(), repeatCooldownHours: z.number().int().min(1).max(8760), defaultChannelId: z.string().optional(), defaultTemplateId: z.string().optional(), maxAttempts: z.number().int().min(1).max(3) });
