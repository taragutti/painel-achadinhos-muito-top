import { createHash } from "node:crypto";
import type { ImportedProduct, MarketplaceImporter } from "./types.js";

/** Deterministic local data for demonstration mode; never contacts a marketplace. */
export class MockProductImporter implements MarketplaceImporter {
  readonly name = "Mock";

  supports(url: URL) {
    return url.hostname === "shopee.com.br" || url.hostname.endsWith(".shopee.com.br");
  }

  async resolveUrl(url: URL) {
    return url;
  }

  async importProduct(url: URL): Promise<ImportedProduct> {
    const fingerprint = createHash("sha256").update(url.href, "utf8").digest("hex").slice(0, 12);
    return {
      marketplace: "SHOPEE",
      sourceUrl: url.href,
      resolvedUrl: url.href,
      affiliateUrl: `https://shope.ee/mock-${fingerprint}`,
      affiliateConfirmed: true,
      title: "Produto fictício de homologação",
      description: "Oferta simulada para validar o fluxo local.",
      currentPrice: "29.90",
      oldPrice: "49.90",
      storeName: "Loja fictícia",
      originalImageUrl: `https://images.example.invalid/mock-${fingerprint}.jpg`,
      incomplete: false,
      warnings: ["Importação simulada; nenhuma API externa foi consultada."],
    };
  }
}
