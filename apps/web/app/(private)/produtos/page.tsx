import type { Marketplace, ProductStatus } from "@achadinhos/database";
import { ProductsView } from "@/components/products/ProductsView";
import { listProducts } from "@/lib/products/application";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuthenticatedAdmin();
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q : undefined;
  const marketplace = ["SHOPEE", "MERCADO_LIVRE", "OTHER"].includes(String(query.marketplace)) ? query.marketplace as Marketplace : undefined;
  const status = ["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(query.status)) ? query.status as ProductStatus : undefined;
  const products = await listProducts({ search, marketplace, status });
  return <ProductsView initialProducts={products.map((product) => ({ ...product, hasPublication: product._count.publications > 0, _count: undefined, currentPrice: product.currentPrice?.toString() ?? null, oldPrice: product.oldPrice?.toString() ?? null, metadata: undefined, createdAt: product.createdAt.toISOString(), lastPublishedAt: product.publications[0]?.publishedAt?.toISOString() ?? null }))} />;
}
