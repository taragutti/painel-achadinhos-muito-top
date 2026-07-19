import { OpenGraphImporter } from "./opengraph.js";
import { SafeHttpClient } from "./safe-http-client.js";
import { ShopeeApiAdapter } from "./shopee-api-adapter.js";
import type { ImportedProduct, MarketplaceImporter } from "./types.js";

const SHOPEE_DOMAINS = ["shopee.com.br", "shope.ee"] as const;

export class ShopeeImporter implements MarketplaceImporter {
  readonly name = "Shopee";
  private readonly fallback: OpenGraphImporter;
  constructor(client = new SafeHttpClient(), private readonly api = new ShopeeApiAdapter()) { this.fallback = new OpenGraphImporter(client, SHOPEE_DOMAINS, "SHOPEE"); }
  supports(url: URL) { return SHOPEE_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)); }
  resolveUrl(url: URL) { return this.fallback.resolveUrl(url); }
  async validateAffiliateUrl(url: URL) { return this.supports(url) && (url.hostname === "shope.ee" || url.searchParams.has("af_siteid") || url.searchParams.has("affiliate_id")); }
  async createAffiliateUrl(url: URL): Promise<URL | null> {
    if (await this.validateAffiliateUrl(url)) return url;
    return this.api.createAffiliateUrl(url);
  }
  async importProduct(url: URL): Promise<ImportedProduct> {
    const alreadyAffiliate = await this.validateAffiliateUrl(url);
    const publicData = await this.fallback.importProduct(url);
    let apiData: Partial<ImportedProduct> | null = null;
    let apiWarning: string | undefined;
    if (this.api.isConfigured()) {
      try {
        apiData = await this.api.importProduct(new URL(publicData.resolvedUrl));
        if (!apiData) apiWarning = "A API da Shopee não encontrou este produto. Revise os dados antes de salvar.";
      } catch (error) {
        apiWarning = error instanceof Error && error.message === "IMPORT_RATE_LIMITED"
          ? "A Shopee limitou temporariamente as consultas. Tente novamente mais tarde."
          : "A API da Shopee está indisponível. Foram usados apenas os metadados públicos.";
      }
    } else {
      apiWarning = "API da Shopee não configurada; usados metadados públicos.";
    }

    const title = apiData?.title ?? publicData.title;
    const currentPrice = apiData?.currentPrice ?? publicData.currentPrice;
    const originalImageUrl = apiData?.originalImageUrl ?? publicData.originalImageUrl;
    const incomplete = !title || !originalImageUrl || !currentPrice;
    const publicWarnings = incomplete ? publicData.warnings : publicData.warnings.filter((warning) => !warning.startsWith("Alguns dados não foram encontrados"));
    return {
      ...publicData,
      ...apiData,
      sourceUrl: url.href,
      resolvedUrl: publicData.resolvedUrl,
      affiliateUrl: alreadyAffiliate ? url.href : apiData?.affiliateUrl ?? publicData.resolvedUrl,
      affiliateConfirmed: alreadyAffiliate || apiData?.affiliateConfirmed === true,
      title,
      currentPrice,
      originalImageUrl,
      incomplete,
      warnings: [...new Set([...publicWarnings, ...(apiWarning ? [apiWarning] : [])])],
    };
  }
}
