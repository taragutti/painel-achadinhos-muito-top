import { Prisma, type Marketplace, type PrismaClient, ProductStatus } from "@prisma/client";

export type ProductListFilters = { search?: string; marketplace?: Marketplace; status?: ProductStatus };

export class ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data });
  }

  findById(id: string) {
    return this.prisma.product.findFirst({ where: { id, deletedAt: null } });
  }

  listActive(filters: ProductListFilters = {}) {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: filters.status ?? { not: ProductStatus.ARCHIVED },
        marketplace: filters.marketplace,
        OR: filters.search ? [
          { title: { contains: filters.search, mode: "insensitive" } },
          { storeName: { contains: filters.search, mode: "insensitive" } },
          { couponCode: { contains: filters.search, mode: "insensitive" } },
        ] : undefined,
      },
      include: { publications: { where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, take: 1, select: { publishedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  update(id: string, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({ where: { id }, data });
  }

  softDelete(id: string, deletedAt = new Date()) {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt, status: ProductStatus.ARCHIVED },
    });
  }

  archive(id: string) {
    return this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
  }

  async duplicate(id: string) {
    const source = await this.findById(id);
    if (!source) throw new Error("Product not found");
    return this.prisma.product.create({ data: {
      marketplace: source.marketplace, sourceUrl: source.sourceUrl, resolvedUrl: source.resolvedUrl,
      affiliateUrl: source.affiliateUrl, affiliateConfirmed: source.affiliateConfirmed,
      title: `${source.title} (cópia)`, description: source.description,
      currentPrice: source.currentPrice, oldPrice: source.oldPrice, currency: source.currency,
      discountPercentage: source.discountPercentage, couponCode: source.couponCode,
      storeName: source.storeName, originalImageUrl: source.originalImageUrl,
      storedImageUrl: source.storedImageUrl, thumbnailImageUrl: source.thumbnailImageUrl,
      metadata: source.metadata as Prisma.InputJsonValue, status: ProductStatus.DRAFT,
    } });
  }
}
