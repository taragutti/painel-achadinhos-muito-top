"use client";

import {
  DEFAULT_PRODUCT_TEMPLATE,
  productImportInputSchema,
  productSaveInputSchema,
  renderMessageTemplate,
  type ProductSaveInput,
  validateProviderMessage,
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
  const [preview, setPreview] = useState<ProductSaveInput | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<"import" | "queue" | null>(null);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  async function importOffer(event: React.FormEvent<HTMLFormElement>) {
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

    setBusy("import");
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

      setWarnings(imported.warnings ?? []);
      setPreview(product.data);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a oferta.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function confirmQueue() {
    if (!preview) return;
    setMessage(null);
    setBusy("queue");
    try {
      const saveResponse = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: preview, intent: "QUEUE" }),
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
      setPreview(null);
      setWarnings([]);
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
            : "Não foi possível colocar na fila.",
      });
    } finally {
      setBusy(null);
    }
  }

  const renderedPreview = preview
    ? renderMessageTemplate(DEFAULT_PRODUCT_TEMPLATE, {
        titulo: preview.title,
        descricao: preview.description,
        precoAtual: preview.currentPrice,
        precoAnterior: preview.oldPrice,
        cupom: preview.couponCode,
        link: preview.affiliateUrl,
        loja: preview.storeName,
        marketplace: preview.marketplace,
      })
    : null;
  const previewValidation = renderedPreview
    ? validateProviderMessage(renderedPreview.text, "WHATSAPP", Boolean(preview?.originalImageUrl))
    : null;

  function discardPreview() {
    setPreview(null);
    setWarnings([]);
    setMessage(null);
  }

  return (
    <section className={`quick-offer-card${preview ? " has-preview" : ""}`}>
      {preview && renderedPreview && previewValidation ? (
        <div className="quick-offer-preview">
          <div className="quick-offer-preview-heading">
            <div>
              <span className="eyebrow">PRÉVIA WHATSAPP</span>
              <h2>Confira antes de colocar na fila</h2>
              <p>{preview.title}</p>
            </div>
            <button className="text-button" type="button" onClick={discardPreview}>
              Trocar link
            </button>
          </div>
          <div className="quick-offer-preview-body">
            <div className="quick-offer-product-summary">
              <span className="eyebrow">PRODUTO IMPORTADO</span>
              <strong>{preview.title}</strong>
              <p>
                {preview.storeName || "Loja não informada"}
                {preview.currentPrice ? ` · R$ ${preview.currentPrice}` : ""}
              </p>
              {preview.affiliateConfirmed && <span className="confirmed-label">Link afiliado confirmado ✓</span>}
            </div>
            <div className="quick-offer-whatsapp">
              <span className="eyebrow">MENSAGEM QUE SERÁ PREPARADA</span>
              <div className="message-bubble whatsapp">
                <pre>{renderedPreview.text}</pre>
              </div>
              <small className={previewValidation.valid ? "preview-valid" : "preview-invalid"}>
                WhatsApp · {previewValidation.characters} caracteres
              </small>
            </div>
          </div>
          {warnings.map((warning) => <p className="form-message warning" role="status" key={warning}>{warning}</p>)}
          {message && <p className={`form-message ${message.kind}`} role="status">{message.text}</p>}
          <div className="quick-offer-preview-actions">
            <button className="secondary" type="button" onClick={discardPreview} disabled={busy !== null}>Cancelar</button>
            <button className="primary" type="button" onClick={() => void confirmQueue()} disabled={busy !== null || !previewValidation.valid}>
              {busy === "queue" ? <><span className="spinner" /> Colocando na fila...</> : "Confirmar e colocar na fila"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="quick-offer-copy">
            <span className="eyebrow">NOVA OFERTA</span>
            <h2>Cole o link da Shopee</h2>
            <p>
              O painel converte para afiliado, mostra a mensagem do WhatsApp e só depois coloca na fila.
            </p>
          </div>
          <form className="quick-offer-form" onSubmit={importOffer}>
            <label htmlFor="shopee-link">LINK DO PRODUTO</label>
            <div>
              <input
                id="shopee-link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://shopee.com.br/..."
                inputMode="url"
                autoComplete="url"
                disabled={busy !== null}
              />
              <button className="primary" disabled={busy !== null}>
                {busy === "import" ? (
                  <>
                    <span className="spinner" /> Convertendo...
                  </>
                ) : (
                  "Converter e visualizar"
                )}
              </button>
            </div>
            {message && (
              <p className={`form-message ${message.kind}`} role="status">
                {message.text}
              </p>
            )}
          </form>
        </>
      )}
    </section>
  );
}
