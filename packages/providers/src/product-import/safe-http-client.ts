import { assertSafeRemoteUrl, type DnsLookup } from "./url-security.js";

export type SafeHttpResult = { finalUrl: URL; body: Uint8Array; contentType: string };
export type SafeHttpClientOptions = {
  fetchImplementation?: typeof fetch;
  dnsLookup?: DnsLookup;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
  cacheTtlMs?: number;
};

export class SafeHttpClient {
  private readonly cache = new Map<string, { expiresAt: number; result: SafeHttpResult }>();
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRedirects: number;
  private readonly maxResponseBytes: number;
  private readonly cacheTtlMs: number;

  constructor(private readonly options: SafeHttpClientOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.PRODUCT_IMPORT_TIMEOUT_MS ?? 8_000);
    this.maxRedirects = options.maxRedirects ?? 3;
    this.maxResponseBytes = options.maxResponseBytes ?? 1_500_000;
    this.cacheTtlMs = options.cacheTtlMs ?? Number(process.env.PRODUCT_IMPORT_CACHE_SECONDS ?? 300) * 1_000;
  }

  async get(url: URL, allowedDomains?: readonly string[]): Promise<SafeHttpResult> {
    const cached = this.cache.get(url.href);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    const result = await this.follow(url, allowedDomains, 0);
    this.cache.set(url.href, { expiresAt: Date.now() + this.cacheTtlMs, result });
    return result;
  }

  private async follow(url: URL, allowedDomains: readonly string[] | undefined, redirects: number): Promise<SafeHttpResult> {
    await assertSafeRemoteUrl(url, allowedDomains, this.options.dnsLookup);
    const response = await this.fetchImplementation(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/jpeg,image/png;q=0.9,*/*;q=0.1", "user-agent": "PainelAchadinhosImporter/1.0" },
    });
    if (response.status === 429) throw new Error("IMPORT_RATE_LIMITED");
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= this.maxRedirects) throw new Error("IMPORT_REDIRECT_LIMIT");
      const location = response.headers.get("location");
      if (!location) throw new Error("IMPORT_REDIRECT_INVALID");
      return this.follow(new URL(location, url), allowedDomains, redirects + 1);
    }
    if (!response.ok || !response.body) throw new Error("IMPORT_UNAVAILABLE");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > this.maxResponseBytes) throw new Error("IMPORT_RESPONSE_TOO_LARGE");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > this.maxResponseBytes) {
        await reader.cancel();
        throw new Error("IMPORT_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return { finalUrl: url, body, contentType: response.headers.get("content-type") ?? "application/octet-stream" };
  }
}
