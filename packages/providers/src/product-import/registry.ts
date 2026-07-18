import { ManualImporter } from "./manual.js";
import { MercadoLivreImporter } from "./mercado-livre.js";
import { OpenGraphImporter } from "./opengraph.js";
import { ShopeeImporter } from "./shopee.js";
import type { ImportedProduct, MarketplaceImporter } from "./types.js";

export class ProductImportService {
  constructor(private readonly importers: MarketplaceImporter[] = [new ShopeeImporter(), new MercadoLivreImporter(), new OpenGraphImporter()], private readonly manual = new ManualImporter()) {}

  async import(rawUrl: string): Promise<ImportedProduct> {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new Error("IMPORT_URL_INVALID"); }
    const importer = this.importers.find((candidate) => candidate.supports(url)) ?? this.manual;
    try { return await importer.importProduct(url); }
    catch (error) {
      if (error instanceof Error && ["URL_SCHEME_BLOCKED", "URL_PRIVATE_BLOCKED", "URL_CREDENTIALS_BLOCKED", "URL_DOMAIN_NOT_ALLOWED"].includes(error.message)) throw error;
      const fallback = await this.manual.importProduct(url);
      return { ...fallback, warnings: [safeImportWarning(error), ...fallback.warnings] };
    }
  }
}

function safeImportWarning(error: unknown) {
  if (error instanceof Error && error.message === "IMPORT_RATE_LIMITED") return "O marketplace limitou as consultas. Complete os dados manualmente ou tente mais tarde.";
  return "Não foi possível consultar o marketplace. O preenchimento manual está disponível.";
}
