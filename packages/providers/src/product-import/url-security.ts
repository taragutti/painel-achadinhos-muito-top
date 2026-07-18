import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type DnsLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export async function assertSafeRemoteUrl(url: URL, allowedDomains?: readonly string[], dnsLookup: DnsLookup = defaultLookup): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL_SCHEME_BLOCKED");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error("URL_PRIVATE_BLOCKED");
  if (url.username || url.password) throw new Error("URL_CREDENTIALS_BLOCKED");
  if (allowedDomains && !allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new Error("URL_DOMAIN_NOT_ALLOWED");
  }

  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await dnsLookup(hostname);
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("URL_PRIVATE_BLOCKED");
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

async function defaultLookup(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}
