import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ManualImporter, MercadoLivreImporter, OpenGraphImporter, ProductImportService, SafeHttpClient, ShopeeApiAdapter, ShopeeImporter, assertSafeRemoteUrl, createShopeeAuthorization, extractShopeeProductIdentity, validateImageSignature } from "../dist/index.js";

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

test("extracts Shopee product identity only from allowed product URLs", () => {
  assert.deepEqual(extractShopeeProductIdentity(new URL("https://shopee.com.br/produto-i.12345.98765")), { shopId: "12345", itemId: "98765" });
  assert.deepEqual(extractShopeeProductIdentity(new URL("https://shopee.com.br/product/12345/98765")), { shopId: "12345", itemId: "98765" });
  assert.equal(extractShopeeProductIdentity(new URL("https://example.com/produto-i.12345.98765")), null);
});

test("signs Shopee payloads using the documented authorization format", () => {
  const payload = JSON.stringify({ query: "query { ping }" });
  const expected = createHash("sha256").update(`test_app1700000000${payload}test_secret`, "utf8").digest("hex");
  assert.equal(
    createShopeeAuthorization("test_app", "test_secret", 1_700_000_000, payload),
    `SHA256 Credential=test_app, Timestamp=1700000000, Signature=${expected}`,
  );
});

test("imports a Shopee product through the signed API and caches the result", async () => {
  let apiCalls = 0;
  const now = () => 1_700_000_000_000;
  const api = new ShopeeApiAdapter(
    { appId: "test_app", appSecret: "test_secret", affiliateId: "test_affiliate", baseUrl: "https://open-api.affiliate.shopee.com.br/graphql" },
    {
      now,
      fetchImplementation: async (input, init) => {
        apiCalls += 1;
        assert.equal(String(input), "https://open-api.affiliate.shopee.com.br/graphql");
        const payload = String(init?.body);
        const expectedSignature = createHash("sha256").update(`test_app1700000000${payload}test_secret`, "utf8").digest("hex");
        assert.equal(init?.headers.authorization, `SHA256 Credential=test_app, Timestamp=1700000000, Signature=${expectedSignature}`);
        assert.deepEqual(JSON.parse(payload).variables, { shopId: "12345", itemId: "98765" });
        return Response.json({ data: { productOfferV2: { nodes: [{ productName: "Achadinho API", itemId: "98765", price: "29.90", imageUrl: "https://cf.shopee.com.br/file/test.jpg", shopName: "Loja API", productLink: "https://shopee.com.br/produto-i.12345.98765", offerLink: "https://shope.ee/affiliate-test" }] } } });
      },
    },
  );
  const productUrl = new URL("https://shopee.com.br/produto-i.12345.98765");
  const first = await api.importProduct(productUrl);
  const second = await api.importProduct(productUrl);
  assert.equal(first?.title, "Achadinho API");
  assert.equal(first?.currentPrice, "29.90");
  assert.equal(first?.storeName, "Loja API");
  assert.equal(first?.affiliateUrl, "https://shope.ee/affiliate-test");
  assert.equal(first?.affiliateConfirmed, true);
  assert.deepEqual(second, first);
  assert.equal(apiCalls, 1);
});

test("combines incomplete public metadata with the official Shopee API result", async () => {
  const url = new URL("https://shopee.com.br/produto-i.12345.98765");
  const publicClient = new SafeHttpClient({ dnsLookup: publicDns, fetchImplementation: async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }) });
  const api = new ShopeeApiAdapter(
    { appId: "test_app", appSecret: "test_secret", baseUrl: "https://open-api.affiliate.shopee.com.br/graphql" },
    { now: () => 1_700_000_000_000, fetchImplementation: async () => Response.json({ data: { productOfferV2: { nodes: [{ productName: "Produto completo", price: "19.90", imageUrl: "https://cf.shopee.com.br/file/test.jpg", shopName: "Loja completa", productLink: url.href, offerLink: "https://s.shopee.com.br/affiliate-test" }] } } }) },
  );
  const product = await new ShopeeImporter(publicClient, api).importProduct(url);
  assert.equal(product.title, "Produto completo");
  assert.equal(product.currentPrice, "19.90");
  assert.equal(product.originalImageUrl, "https://cf.shopee.com.br/file/test.jpg");
  assert.equal(product.affiliateUrl, "https://s.shopee.com.br/affiliate-test");
  assert.equal(product.affiliateConfirmed, true);
  assert.equal(product.incomplete, false);
  assert.equal(product.warnings.length, 0);
});

test("generates a Shopee affiliate link without contacting a real API", async () => {
  const api = new ShopeeApiAdapter(
    { appId: "test_app", appSecret: "test_secret", baseUrl: "https://open-api.affiliate.shopee.com.br" },
    { now: () => 1_700_000_000_000, fetchImplementation: async (_input, init) => {
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.variables.input.originUrl, "https://shopee.com.br/produto-i.12345.98765");
      return Response.json({ data: { generateShortLink: { shortLink: "https://shope.ee/generated-test", longLink: "https://shopee.com.br/affiliate-long" } } });
    } },
  );
  assert.equal((await api.createAffiliateUrl(new URL("https://shopee.com.br/produto-i.12345.98765")))?.href, "https://shope.ee/generated-test");
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
