import assert from "node:assert/strict";
import test from "node:test";
import { downloadWhatsAppImage } from "../dist/whatsapp-image.js";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);

function imageClient(result) {
  return {
    async get(url) {
      assert.equal(url.href, "https://images.example.com/product.jpg");
      return result;
    },
  };
}

test("downloads a validated WhatsApp image into a buffer", async () => {
  const result = await downloadWhatsAppImage(
    "https://images.example.com/product.jpg",
    imageClient({
      finalUrl: new URL("https://images.example.com/product.jpg"),
      body: jpeg,
      contentType: "image/jpeg; charset=binary",
    }),
  );

  assert.ok(Buffer.isBuffer(result));
  assert.deepEqual(result, Buffer.from(jpeg));
});

test("rejects an invalid image URL before using the HTTP client", async () => {
  let requested = false;

  await assert.rejects(
    downloadWhatsAppImage("not-a-url", {
      async get() {
        requested = true;
        throw new Error("unexpected request");
      },
    }),
    /URL inválida/,
  );
  assert.equal(requested, false);
});

test("rejects non-image content and invalid image signatures", async () => {
  await assert.rejects(
    downloadWhatsAppImage(
      "https://images.example.com/product.jpg",
      imageClient({
        finalUrl: new URL("https://images.example.com/product.jpg"),
        body: jpeg,
        contentType: "text/html",
      }),
    ),
    /não retornou uma imagem/,
  );

  await assert.rejects(
    downloadWhatsAppImage(
      "https://images.example.com/product.jpg",
      imageClient({
        finalUrl: new URL("https://images.example.com/product.jpg"),
        body: new TextEncoder().encode("not an image"),
        contentType: "image/jpeg",
      }),
    ),
    /IMAGE_FORMAT_INVALID/,
  );
});
