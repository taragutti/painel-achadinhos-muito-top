import assert from "node:assert/strict";
import test from "node:test";
import { ManualImporter, MercadoLivreImporter, OpenGraphImporter, ProductImportService, SafeHttpClient, ShopeeImporter, assertSafeRemoteUrl, validateImageSignature } from "../dist/index.js";

const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
const html = '<html><head><meta property="og:title" content="Achadinho"><meta property="og:image" content="/foto.jpg"><meta property="product:price:amount" content="39.90"></head></html>';
const htmlResponse = (url = "https://loja.example/produto") => new Response(html, { status: 200, headers: { "content-type": "text/html", "content-length": String(html.length), "x-url": url } });

test("accepts a valid public HTTP link and imports public metadata", async () => {
  const importer = new OpenGraphImporter(new SafeHttpClient({ dnsLookup: publicDns, fetchImplementation: async () => htmlResponse() }));
  const product = await importer.importProduct(new URL("https://loja.example/produto"));
  assert.equal(product.title, "Achadinho"); assert.equal(product.currentPrice, "39.90"); assert.equal(product.incomplete, false);
});

test("rejects invalid and private URLs", async () => {
  await assert.rejects(() => new ProductImportService().import("not-a-url"), /IMPORT_URL_INVALID/);
  await assert.rejects(() => assertSafeRemoteUrl(new URL("http://localhost/item"), undefined, publicDns), /URL_PRIVATE_BLOCKED/);
  await assert.rejects(() => assertSafeRemoteUrl(new URL("http://192.168.1.20/item"), undefined, publicDns), /URL_PRIVATE_BLOCKED/);
  await assert.rejects(() => assertSafeRemoteUrl(new URL("ftp://example.com/item"), undefined, publicDns), /URL_SCHEME_BLOCKED/);
});

test("follows a bounded public redirect", async () => {
  let calls = 0;
  const client = new SafeHttpClient({ dnsLookup: publicDns, fetchImplementation: async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: "/final" } }) : htmlResponse() });
  const result = await client.get(new URL("https://loja.example/inicial"));
  assert.equal(result.finalUrl.href, "https://loja.example/final"); assert.equal(calls, 2);
});

test("preserves an existing affiliate link", async () => {
  assert.equal(await new ShopeeImporter().validateAffiliateUrl(new URL("https://shope.ee/abc")), true);
  assert.equal(await new MercadoLivreImporter().validateAffiliateUrl(new URL("https://meli.la/abc")), true);
});

test("marks an incomplete import for manual review", async () => {
  const importer = new OpenGraphImporter(new SafeHttpClient({ dnsLookup: publicDns, fetchImplementation: async () => new Response("<title>Produto</title>") }));
  assert.equal((await importer.importProduct(new URL("https://loja.example/item"))).incomplete, true);
});

test("falls back to manual entry when an API is unavailable", async () => {
  const failing = { name: "Unavailable", supports: () => true, resolveUrl: async (url) => url, importProduct: async () => { throw new Error("IMPORT_UNAVAILABLE"); } };
  const product = await new ProductImportService([failing]).import("https://loja.example/item");
  assert.equal(product.incomplete, true); assert.match(product.warnings[0], /Não foi possível/);
});

test("supports explicit manual entry", async () => {
  const product = await new ManualImporter().importProduct(new URL("https://loja.example/item"));
  assert.equal(product.marketplace, "OTHER"); assert.equal(product.sourceUrl, product.affiliateUrl);
});

test("rejects an image whose bytes do not match its extension", () => {
  assert.throws(() => validateImageSignature(new TextEncoder().encode("not an image"), "produto.jpg"), /IMAGE_FORMAT_INVALID/);
  assert.throws(() => validateImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "produto.png"), /IMAGE_CONTENT_MISMATCH/);
});
