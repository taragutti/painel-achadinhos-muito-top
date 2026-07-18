import { randomUUID } from "node:crypto";
import { type MessageCategory, type Platform, PublicationType } from "@prisma/client";
import type { PublicationRepository } from "../repositories/publication-repository.js";

export type CreatePublicationInput = {
  type: PublicationType;
  productId?: string;
  title?: string;
  customMessage?: string;
  destinationLink?: string;
  mediaUrl?: string;
  idempotencyKey?: string;
  couponCode?: string;
  category?: MessageCategory;
  platforms?: Platform[];
  templateId?: string;
  metadata?: Record<string, string | string[]>;
};

export class PublicationService {
  constructor(private readonly publications: PublicationRepository) {}

  create(input: CreatePublicationInput) {
    if (input.type === PublicationType.PRODUCT && !input.productId) throw new Error("Product publication requires a product");
    if (input.type === PublicationType.FREE_TEXT && !input.customMessage?.trim()) throw new Error("Free text publication requires a message");
    if (input.type === PublicationType.ART_LINK && (!input.mediaUrl || !input.destinationLink)) throw new Error("Art publication requires media and destination link");

    return this.publications.create({
      type: input.type,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      product: input.productId ? { connect: { id: input.productId } } : undefined,
      title: input.title?.trim(),
      customMessage: input.customMessage?.trim(),
      destinationLink: input.destinationLink,
      mediaUrl: input.mediaUrl,
      couponCode: input.couponCode?.trim(),
      category: input.category,
      platforms: input.platforms ?? [],
      template: input.templateId ? { connect: { id: input.templateId } } : undefined,
      metadata: input.metadata ?? {},
    });
  }
}
