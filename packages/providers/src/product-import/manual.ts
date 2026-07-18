import type { ImportedProduct, MarketplaceImporter } from "./types.js";

export class ManualImporter implements MarketplaceImporter {
  readonly name = "Manual";
  supports(): boolean { return true; }
  async resolveUrl(url: URL): Promise<URL> { return url; }
  async importProduct(url: URL): Promise<ImportedProduct> {
    return { marketplace: "OTHER", sourceUrl: url.href, resolvedUrl: url.href, affiliateUrl: url.href, affiliateConfirmed: false, incomplete: true, warnings: ["Preencha os dados do produto manualmente."] };
  }
}
