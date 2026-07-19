import { createHash } from "node:crypto";
import type { ImportedProduct } from "./types.js";

const SHOPEE_API_DOMAIN = "open-api.affiliate.shopee.com.br";
const SHOPEE_LINK_DOMAINS = ["shopee.com.br", "shope.ee"] as const;
const PRODUCT_QUERY = `query ProductOffer($itemId: Int64!, $shopId: Int64) {
  productOfferV2(itemId: $itemId, shopId: $shopId, limit: 1) {
    nodes {
      productName
      itemId
      price
      priceMin
      priceMax
      imageUrl
      shopName
      shopId
      productLink
      offerLink
      priceDiscountRate
    }
  }
}`;
const SHORT_LINK_MUTATION = `mutation GenerateShortLink($input: ShortLinkInput!) {
  generateShortLink(input: $input) {
    shortLink
    longLink
  }
}`;

export type ShopeeConfiguration = {
  appId?: string;
  appSecret?: string;
  affiliateId?: string;
  baseUrl?: string;
};

export type ShopeeApiAdapterOptions = {
  fetchImplementation?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxResponseBytes?: number;
};

type ShopeeProductIdentity = { shopId: string; itemId: string };
type GraphQlEnvelope = { data?: unknown; errors?: unknown };

export class ShopeeApiAdapter {
  private readonly cache = new Map<string, { expiresAt: number; product: Partial<ImportedProduct> | null }>();
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly maxResponseBytes: number;

  constructor(
    private readonly configuration: ShopeeConfiguration = configurationFromEnvironment(),
    options: ShopeeApiAdapterOptions = {},
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.PRODUCT_IMPORT_TIMEOUT_MS ?? 8_000);
    this.cacheTtlMs = options.cacheTtlMs ?? Number(process.env.PRODUCT_IMPORT_CACHE_SECONDS ?? 300) * 1_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 256_000;
  }

  isConfigured(): boolean {
    return Boolean(
      this.configuration.appId?.trim()
      && this.configuration.appSecret?.trim()
      && this.configuration.baseUrl?.trim()
      && safeEndpoint(this.configuration.baseUrl),
    );
  }

  async importProduct(url: URL): Promise<Partial<ImportedProduct> | null> {
    if (!this.isConfigured()) return null;
    const identity = extractShopeeProductIdentity(url);
    if (!identity) return null;

    const cacheKey = `${identity.shopId}:${identity.itemId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) return cached.product;

    const response = await this.execute(PRODUCT_QUERY, identity);
    const node = firstProductNode(response);
    const product = node ? mapProductNode(node, url) : null;
    this.cache.set(cacheKey, { expiresAt: this.now() + this.cacheTtlMs, product });
    return product;
  }

  async createAffiliateUrl(url: URL): Promise<URL | null> {
    if (!this.isConfigured() || !isAllowedShopeeLink(url)) return null;
    const response = await this.execute(SHORT_LINK_MUTATION, { input: { originUrl: url.href } });
    const result = nestedRecord(nestedRecord(response, "data"), "generateShortLink");
    const candidate = stringValue(result?.shortLink) ?? stringValue(result?.longLink);
    if (!candidate) return null;
    const affiliateUrl = new URL(candidate);
    return isAllowedShopeeLink(affiliateUrl) ? affiliateUrl : null;
  }

  private async execute(query: string, variables: Record<string, unknown>): Promise<GraphQlEnvelope> {
    const endpoint = requireEndpoint(this.configuration.baseUrl);
    const appId = this.configuration.appId?.trim();
    const appSecret = this.configuration.appSecret?.trim();
    if (!appId || !appSecret) throw new Error("SHOPEE_API_NOT_CONFIGURED");

    const payload = JSON.stringify({ query, variables });
    const timestamp = Math.ceil(this.now() / 1_000);
    const authorization = createShopeeAuthorization(appId, appSecret, timestamp, payload);
    let response: Response;
    try {
      response = await this.fetchImplementation(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          accept: "application/json",
          authorization,
          "content-type": "application/json",
          "user-agent": "PainelAchadinhosImporter/1.0",
        },
        body: payload,
      });
    } catch {
      throw new Error("SHOPEE_API_UNAVAILABLE");
    }

    if (response.status === 429) throw new Error("IMPORT_RATE_LIMITED");
    if (!response.ok) throw new Error("SHOPEE_API_UNAVAILABLE");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > this.maxResponseBytes) throw new Error("IMPORT_RESPONSE_TOO_LARGE");
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > this.maxResponseBytes) throw new Error("IMPORT_RESPONSE_TOO_LARGE");

    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { throw new Error("SHOPEE_API_INVALID_RESPONSE"); }
    if (!isRecord(parsed)) throw new Error("SHOPEE_API_INVALID_RESPONSE");
    if (Array.isArray(parsed.errors) && parsed.errors.length) throw new Error("SHOPEE_API_REJECTED");
    return parsed;
  }
}

export function extractShopeeProductIdentity(url: URL): ShopeeProductIdentity | null {
  if (!isAllowedShopeeLink(url)) return null;
  const itemPath = url.pathname.match(/(?:^|-)i\.(\d+)\.(\d+)(?:$|\/)/i);
  if (itemPath) return { shopId: itemPath[1], itemId: itemPath[2] };
  const productPath = url.pathname.match(/^\/product\/(\d+)\/(\d+)(?:\/|$)/i);
  return productPath ? { shopId: productPath[1], itemId: productPath[2] } : null;
}

export function createShopeeAuthorization(appId: string, appSecret: string, timestamp: number, payload: string): string {
  const signature = createHash("sha256").update(`${appId}${timestamp}${payload}${appSecret}`, "utf8").digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

function configurationFromEnvironment(): ShopeeConfiguration {
  return {
    appId: process.env.SHOPEE_APP_ID,
    appSecret: process.env.SHOPEE_APP_SECRET,
    affiliateId: process.env.SHOPEE_AFFILIATE_ID,
    baseUrl: process.env.SHOPEE_API_BASE_URL,
  };
}

function safeEndpoint(rawBaseUrl?: string): URL | null {
  try { return requireEndpoint(rawBaseUrl); } catch { return null; }
}

function requireEndpoint(rawBaseUrl?: string): URL {
  if (!rawBaseUrl) throw new Error("SHOPEE_API_NOT_CONFIGURED");
  const endpoint = new URL(rawBaseUrl);
  if (endpoint.protocol !== "https:" || endpoint.hostname !== SHOPEE_API_DOMAIN || endpoint.username || endpoint.password) {
    throw new Error("SHOPEE_API_CONFIGURATION_INVALID");
  }
  if (endpoint.pathname === "/" || endpoint.pathname === "") endpoint.pathname = "/graphql";
  if (endpoint.pathname !== "/graphql" || endpoint.search || endpoint.hash) throw new Error("SHOPEE_API_CONFIGURATION_INVALID");
  return endpoint;
}

function isAllowedShopeeLink(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  return url.protocol === "https:" && !url.username && !url.password
    && SHOPEE_LINK_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function firstProductNode(response: GraphQlEnvelope): Record<string, unknown> | null {
  const offer = nestedRecord(nestedRecord(response, "data"), "productOfferV2");
  const nodes = offer?.nodes;
  return Array.isArray(nodes) && isRecord(nodes[0]) ? nodes[0] : null;
}

function mapProductNode(node: Record<string, unknown>, requestedUrl: URL): Partial<ImportedProduct> {
  const productLink = safeShopeeUrl(stringValue(node.productLink)) ?? requestedUrl.href;
  const offerLink = safeShopeeUrl(stringValue(node.offerLink));
  const title = stringValue(node.productName);
  return {
    marketplace: "SHOPEE",
    sourceUrl: requestedUrl.href,
    resolvedUrl: productLink,
    affiliateUrl: offerLink ?? productLink,
    affiliateConfirmed: Boolean(offerLink),
    title,
    currentPrice: moneyValue(node.price) ?? moneyValue(node.priceMin) ?? moneyValue(node.priceMax),
    storeName: stringValue(node.shopName),
    originalImageUrl: safeHttpUrl(stringValue(node.imageUrl)),
    incomplete: !title,
    warnings: [],
  };
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  return isRecord(value[key]) ? value[key] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function moneyValue(value: unknown): string | undefined {
  const text = stringValue(value);
  return text && /^\d+(?:\.\d{1,4})?$/.test(text) ? text : undefined;
}

function safeHttpUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function safeShopeeUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    return isAllowedShopeeLink(url) ? url.href : undefined;
  } catch { return undefined; }
}
