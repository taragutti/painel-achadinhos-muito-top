import { OpenGraphImporter } from "./opengraph.js";
import { SafeHttpClient } from "./safe-http-client.js";
import type { ImportedProduct, MarketplaceImporter } from "./types.js";

const MERCADO_LIVRE_DOMAINS = ["mercadolivre.com.br", "mercadolibre.com", "meli.la"] as const;

export class MercadoLivreImporter implements MarketplaceImporter {
  readonly name = "Mercado Livre";
  private readonly fallback: OpenGraphImporter;
  constructor(client = new SafeHttpClient()) { this.fallback = new OpenGraphImporter(client, MERCADO_LIVRE_DOMAINS, "MERCADO_LIVRE"); }
  supports(url: URL) { return MERCADO_LIVRE_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)); }
  resolveUrl(url: URL) { return this.fallback.resolveUrl(url); }
  async validateAffiliateUrl(url: URL) { return this.supports(url) && (url.hostname === "meli.la" || url.searchParams.has("matt_tool") || url.searchParams.has("matt_word")); }
  async createAffiliateUrl(): Promise<URL | null> { return null; }
  async importProduct(url: URL): Promise<ImportedProduct> {
    const affiliateConfirmed = await this.validateAffiliateUrl(url);
    const product = await this.fallback.importProduct(url);
    return { ...product, sourceUrl: url.href, affiliateUrl: affiliateConfirmed ? url.href : product.resolvedUrl, affiliateConfirmed };
  }
}
