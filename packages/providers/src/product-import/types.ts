export type ImportedMarketplace = "SHOPEE" | "MERCADO_LIVRE" | "OTHER";

export type ImportedProduct = {
  marketplace: ImportedMarketplace;
  sourceUrl: string;
  resolvedUrl: string;
  affiliateUrl: string;
  affiliateConfirmed: boolean;
  title?: string;
  description?: string;
  currentPrice?: string;
  oldPrice?: string;
  storeName?: string;
  originalImageUrl?: string;
  incomplete: boolean;
  warnings: string[];
};

export interface MarketplaceImporter {
  readonly name: string;
  supports(url: URL): boolean;
  resolveUrl(url: URL): Promise<URL>;
  importProduct(url: URL): Promise<ImportedProduct>;
  createAffiliateUrl?(url: URL): Promise<URL | null>;
  validateAffiliateUrl?(url: URL): Promise<boolean>;
}
