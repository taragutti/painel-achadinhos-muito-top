"use client";

import {
  productImportInputSchema,
  productSaveInputSchema,
  type ProductSaveInput,
} from "@achadinhos/shared";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportedProduct = Partial<ProductSaveInput> & {
  warnings?: string[];
  incomplete?: boolean;
};

export function QuickOfferForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  async function queueOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const parsedUrl = productImportInputSchema.safeParse({ url });
    if (!parsedUrl.success) {
      setMessage({
        kind: "error",
        text: "Cole um link válido de produto da Shopee.",
      });
      return;
    }

    setBusy(true);
    try {
      const importResponse = await fetch("/api/products/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedUrl.data),
      });
      const imported = (await importResponse.json()) as ImportedProduct & {
        error?: string;
      };
      if (!importResponse.ok) {
        throw new Error(imported.error ?? "Não foi possível ler esse produto.");
      }
      if (!imported.affiliateConfirmed) {
        throw new Error(
          "A Shopee não confirmou o link afiliado. Confira a integração e tente novamente.",
        );
      }

      const product = productSaveInputSchema.safeParse({
        marketplace: imported.marketplace ?? "SHOPEE",
        sourceUrl: imported.sourceUrl ?? url,
        resolvedUrl: imported.resolvedUrl ?? url,
        affiliateUrl: imported.affiliateUrl,
        affiliateConfirmed: true,
        title: imported.title,
        description: imported.description ?? "",
        oldPrice: imported.oldPrice ?? "",
        currentPrice: imported.currentPrice ?? "",
        couponCode: imported.couponCode ?? "",
        storeName: imported.storeName ?? "",
        originalImageUrl: imported.originalImageUrl ?? "",
        storedImageUrl: imported.storedImageUrl ?? "",
        thumbnailImageUrl: imported.thumbnailImageUrl ?? "",
        internalNotes: "",
        status: "ACTIVE",
      });
      if (!product.success) {
        throw new Error(
          "A Shopee não devolveu todos os dados do produto. Tente outro link.",
        );
      }

      const saveResponse = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: product.data, intent: "QUEUE" }),
      });
      const saved = (await saveResponse.json()) as {
        queued?: boolean;
        warning?: string;
        error?: string;
      };
      if (!saveResponse.ok) {
        throw new Error(saved.error ?? "Não foi possível colocar na fila.");
      }
      if (!saved.queued) {
        throw new Error(
          saved.warning ?? "Conecte um grupo do WhatsApp antes de criar a fila.",
        );
      }

      setUrl("");
      setMessage({
        kind: "success",
        text: "Link afiliado criado. Oferta adicionada à fila de postagem.",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a oferta.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="quick-offer-card">
      <div className="quick-offer-copy">
        <span className="eyebrow">NOVA OFERTA</span>
        <h2>Cole o link da Shopee</h2>
        <p>
          O painel converte para afiliado, monta a mensagem e coloca na fila
          automaticamente.
        </p>
      </div>
      <form className="quick-offer-form" onSubmit={queueOffer}>
        <label htmlFor="shopee-link">LINK DO PRODUTO</label>
        <div>
          <input
            id="shopee-link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://shopee.com.br/..."
            inputMode="url"
            autoComplete="url"
            disabled={busy}
          />
          <button className="primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" /> Convertendo...
              </>
            ) : (
              "Converter e colocar na fila"
            )}
          </button>
        </div>
        {message && (
          <p className={`form-message ${message.kind}`} role="status">
            {message.text}
          </p>
        )}
      </form>
    </section>
  );
}
