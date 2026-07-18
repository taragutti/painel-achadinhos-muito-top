import type { ProductSaveInput } from "@achadinhos/shared";
import { PublicationStudio } from "@/components/publications/PublicationStudio";
import { getProduct } from "@/lib/products/application";
import { getPublication, listActiveTemplates } from "@/lib/publications/application";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export default async function NewPublicationPage({ searchParams }: { searchParams: Promise<{ productId?: string; publicationId?: string }> }) {
  await requireAuthenticatedAdmin();
  const { productId, publicationId } = await searchParams;
  const publication = publicationId ? await getPublication(publicationId) : null;
  const [existing, templates] = await Promise.all([(productId ?? publication?.productId) ? getProduct((productId ?? publication?.productId)!) : null, listActiveTemplates()]);
  const initialProduct: ProductSaveInput | undefined = existing ? {
    marketplace: existing.marketplace === "SHOPEE" || existing.marketplace === "MERCADO_LIVRE" ? existing.marketplace : "OTHER",
    sourceUrl: existing.sourceUrl, resolvedUrl: existing.resolvedUrl, affiliateUrl: existing.affiliateUrl,
    affiliateConfirmed: existing.affiliateConfirmed, title: existing.title, description: existing.description,
    oldPrice: existing.oldPrice?.toString() ?? "", currentPrice: existing.currentPrice?.toString() ?? "",
    couponCode: existing.couponCode ?? "", storeName: existing.storeName ?? "",
    originalImageUrl: existing.originalImageUrl ?? "", storedImageUrl: existing.storedImageUrl ?? "", thumbnailImageUrl: existing.thumbnailImageUrl ?? "",
    internalNotes: typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata) && typeof existing.metadata.internalNotes === "string" ? existing.metadata.internalNotes : "",
    status: existing.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
  } : undefined;
  return <PublicationStudio productId={existing?.id} initialProduct={initialProduct} initialPublication={publication && publication.type !== "PRODUCT" ? { id: publication.id, type: publication.type, title: publication.title ?? "", message: publication.customMessage ?? "", link: publication.destinationLink ?? "", coupon: publication.couponCode ?? "", mediaUrl: publication.mediaUrl ?? "", templateId: publication.templateId ?? "", category: publication.category ?? "SIMPLE", platforms: publication.platforms } : undefined} templates={templates.map(({ id, name, platform, content }) => ({ id, name, platform, content }))} />;
}
