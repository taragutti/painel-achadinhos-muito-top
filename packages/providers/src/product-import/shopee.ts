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
  async createAffiliateUrl(): Promise<URL | null> { return null; }
  async importProduct(url: URL): Promise<ImportedProduct> {
    const alreadyAffiliate = await this.validateAffiliateUrl(url);
    const publicData = await this.fallback.importProduct(url);
    const apiData = await this.api.importProduct(new URL(publicData.resolvedUrl)).catch(() => null);
    return { ...publicData, ...apiData, sourceUrl: url.href, affiliateUrl: alreadyAffiliate ? url.href : publicData.resolvedUrl, affiliateConfirmed: alreadyAffiliate, warnings: [...publicData.warnings, ...(this.api.isConfigured() ? [] : ["API da Shopee não configurada; usados metadados públicos."])] };
  }
}
