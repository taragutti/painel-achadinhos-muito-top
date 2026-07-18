import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PRODUCT_TEMPLATE, renderMessageTemplate, validateProviderMessage } from "../dist/index.js";

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
