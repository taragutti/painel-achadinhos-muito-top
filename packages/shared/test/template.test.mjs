import assert from "node:assert/strict";
import test from "node:test";
import { buildProductMessage, DEFAULT_PRODUCT_TEMPLATE, renderMessageTemplate, validateProviderMessage } from "../dist/index.js";

test("renders known variables and keeps the link intact", () => {
  const link = "https://loja.example/oferta?a=1&b=2";
  const result = renderMessageTemplate(DEFAULT_PRODUCT_TEMPLATE, { titulo: "Oferta", precoAtual: "99,90", link });
  assert.match(result.text, /Oferta/); assert.match(result.text, /99,90/); assert.ok(result.text.includes(link));
});

test("removes absent conditional blocks and unknown variables", () => {
  const result = renderMessageTemplate("{{#cupom}}Cupom {{cupom}}{{/cupom}}\n{{inexistente}}\nTexto", {});
  assert.equal(result.text, "Texto"); assert.deepEqual(result.missingFields, ["cupom"]);
});

test("does not execute template content and enforces provider limits", () => {
  const result = renderMessageTemplate("{{constructor.constructor('return process')()}}Seguro", {});
  assert.equal(result.text, "Seguro");
  assert.equal(validateProviderMessage("x".repeat(1025), "TELEGRAM", true).valid, false);
  assert.equal(validateProviderMessage("mensagem", "WHATSAPP").valid, true);
});

test("builds a WhatsApp product message with price and affiliate link", () => {
  const text = buildProductMessage({
    title: "Achadinho",
    currentPrice: "29.90",
    oldPrice: "49.90",
    couponCode: "TOP10",
    affiliateUrl: "https://shope.ee/affiliate-test",
  });
  assert.match(text, /Achadinho/);
  assert.match(text, /29\.90/);
  assert.match(text, /TOP10/);
  assert.match(text, /https:\/\/shope\.ee\/affiliate-test/);
});
