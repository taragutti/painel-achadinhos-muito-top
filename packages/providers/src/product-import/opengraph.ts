import type { ImportedMarketplace, ImportedProduct, MarketplaceImporter } from "./types.js";
import { SafeHttpClient } from "./safe-http-client.js";

export class OpenGraphImporter implements MarketplaceImporter {
  readonly name = "OpenGraph";
  constructor(protected readonly client: SafeHttpClient = new SafeHttpClient(), private readonly allowedDomains?: readonly string[], private readonly marketplace: ImportedMarketplace = "OTHER") {}
  supports(): boolean { return true; }
  async resolveUrl(url: URL): Promise<URL> { return (await this.client.get(url, this.allowedDomains)).finalUrl; }
  async importProduct(source: URL): Promise<ImportedProduct> {
    const response = await this.client.get(source, this.allowedDomains);
    const html = new TextDecoder().decode(response.body);
    const title = meta(html, "og:title") ?? meta(html, "twitter:title") ?? tagTitle(html);
    const description = meta(html, "og:description") ?? meta(html, "description");
    const image = meta(html, "og:image") ?? meta(html, "twitter:image");
    const currentPrice = meta(html, "product:price:amount") ?? jsonLdPrice(html);
    return {
      marketplace: this.marketplace,
      sourceUrl: source.href,
      resolvedUrl: response.finalUrl.href,
      affiliateUrl: source.href,
      affiliateConfirmed: false,
      title: clean(title), description: clean(description), currentPrice,
      originalImageUrl: image ? new URL(image, response.finalUrl).href : undefined,
      incomplete: !title || !image || !currentPrice,
      warnings: !title || !image || !currentPrice ? ["Alguns dados não foram encontrados. Complete os campos manualmente."] : [],
    };
  }
}

function meta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean);
}
function tagTitle(html: string) { return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]; }
function jsonLdPrice(html: string) { return html.match(/["']price["']\s*:\s*["']?([0-9]+(?:[.,][0-9]{1,2})?)/i)?.[1]?.replace(",", "."); }
function clean(value?: string) { return value?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
