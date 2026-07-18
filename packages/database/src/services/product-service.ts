import { Prisma, ProductStatus, type Marketplace } from "@prisma/client";
import type { ProductRepository } from "../repositories/product-repository.js";

export type CreateProductInput = {
  marketplace: Marketplace;
  sourceUrl: string;
  resolvedUrl: string;
  affiliateUrl: string;
  title: string;
  description?: string;
  currentPrice?: string;
  oldPrice?: string;
  affiliateConfirmed?: boolean;
  couponCode?: string;
  storeName?: string;
  originalImageUrl?: string;
  storedImageUrl?: string;
  thumbnailImageUrl?: string;
  internalNotes?: string;
  status?: "DRAFT" | "ACTIVE";
};

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  create(input: CreateProductInput) {
    const sourceUrl = assertHttpUrl(input.sourceUrl, "sourceUrl");
    const resolvedUrl = assertHttpUrl(input.resolvedUrl, "resolvedUrl");
    const affiliateUrl = assertHttpUrl(input.affiliateUrl, "affiliateUrl");
    const title = input.title.trim();
    if (!title) throw new Error("Product title is required");

    return this.products.create({
      marketplace: input.marketplace,
      sourceUrl,
      resolvedUrl,
      affiliateUrl,
      title,
      description: input.description?.trim() ?? "",
      currentPrice: input.currentPrice === undefined ? undefined : new Prisma.Decimal(input.currentPrice),
      oldPrice: input.oldPrice === undefined ? undefined : new Prisma.Decimal(input.oldPrice),
      affiliateConfirmed: input.affiliateConfirmed ?? false,
      couponCode: emptyToUndefined(input.couponCode),
      storeName: emptyToUndefined(input.storeName),
      originalImageUrl: optionalHttpUrl(input.originalImageUrl, "originalImageUrl"),
      storedImageUrl: optionalHttpUrl(input.storedImageUrl, "storedImageUrl"),
      thumbnailImageUrl: optionalHttpUrl(input.thumbnailImageUrl, "thumbnailImageUrl"),
      metadata: { internalNotes: input.internalNotes?.trim() ?? "" },
      status: input.status === "ACTIVE" ? ProductStatus.ACTIVE : ProductStatus.DRAFT,
    });
  }

  remove(id: string) {
    if (!id.trim()) throw new Error("Product id is required");
    return this.products.softDelete(id);
  }
}

function optionalHttpUrl(value: string | undefined, field: string) { return value ? assertHttpUrl(value, field) : undefined; }
function emptyToUndefined(value?: string) { const normalized = value?.trim(); return normalized || undefined; }

function assertHttpUrl(value: string, field: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${field} must use HTTP or HTTPS`);
  return url.toString();
}
