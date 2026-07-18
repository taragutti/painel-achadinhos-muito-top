import type { ImportedProduct } from "./types.js";
import { SafeHttpClient } from "./safe-http-client.js";

type ShopeeConfiguration = { appId?: string; appSecret?: string; affiliateId?: string; baseUrl?: string };

export class ShopeeApiAdapter {
  constructor(private readonly configuration: ShopeeConfiguration = configurationFromEnvironment(), private readonly client = new SafeHttpClient()) {}
  isConfigured() { return Boolean(this.configuration.appId && this.configuration.appSecret && this.configuration.affiliateId && this.configuration.baseUrl); }

  async importProduct(url: URL): Promise<Partial<ImportedProduct> | null> {
    if (!this.isConfigured()) return null;
    // The owner-provided API contract is still pending. Keep credentials isolated
    // and use public metadata until endpoint names and signing are confirmed.
    void url;
    void this.client;
    return null;
  }
}

function configurationFromEnvironment(): ShopeeConfiguration {
  return { appId: process.env.SHOPEE_APP_ID, appSecret: process.env.SHOPEE_APP_SECRET, affiliateId: process.env.SHOPEE_AFFILIATE_ID, baseUrl: process.env.SHOPEE_API_BASE_URL };
}
