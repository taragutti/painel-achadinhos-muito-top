"use client";

import { DEFAULT_PRODUCT_TEMPLATE, productImportInputSchema, productSaveInputSchema, renderMessageTemplate, validateProviderMessage, type ProductSaveInput } from "@achadinhos/shared";
import Image from "next/image";
import { useRef, useState } from "react";

type ImportedData = Partial<ProductSaveInput> & { warnings?: string[]; incomplete?: boolean };
const emptyProduct: ProductSaveInput = { marketplace: "OTHER", sourceUrl: "", resolvedUrl: "", affiliateUrl: "", affiliateConfirmed: false, title: "", description: "", oldPrice: "", currentPrice: "", couponCode: "", storeName: "", originalImageUrl: "", storedImageUrl: "", thumbnailImageUrl: "", internalNotes: "", status: "DRAFT" };

export function ProductImporterForm({ productId, initialProduct }: { productId?: string; initialProduct?: ProductSaveInput }) {
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<ProductSaveInput>(initialProduct ?? emptyProduct);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stage, setStage] = useState<"link" | "preview">(initialProduct ? "preview" : "link");
  const [busy, setBusy] = useState<"import" | "image" | "save" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof ProductSaveInput>(key: K, value: ProductSaveInput[K]) => setProduct((current) => ({ ...current, [key]: value }));

  async function importProduct() {
    setMessage(null);
    const parsed = productImportInputSchema.safeParse({ url });
    if (!parsed.success) { setMessage({ kind: "error", text: "Cole um link HTTP ou HTTPS válido." }); return; }
    setBusy("import");
    try {
      const response = await fetch("/api/products/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await response.json() as ImportedData & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível importar.");
      setProduct({ ...emptyProduct, ...data, sourceUrl: data.sourceUrl ?? url, resolvedUrl: data.resolvedUrl ?? url, affiliateUrl: data.affiliateUrl ?? url });
      setWarnings(data.warnings ?? []);
      setStage("preview");
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível importar." }); }
    finally { setBusy(null); }
  }

  async function uploadImage(file: File) {
    setBusy("image"); setMessage(null);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/products/images", { method: "POST", body: form });
      const data = await response.json() as { storedImageUrl?: string; thumbnailImageUrl?: string; error?: string };
      if (!response.ok || !data.storedImageUrl) throw new Error(data.error ?? "Imagem inválida.");
      setProduct((current) => ({ ...current, storedImageUrl: data.storedImageUrl, thumbnailImageUrl: data.thumbnailImageUrl }));
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Imagem inválida." }); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function ensureOwnedImage(current: ProductSaveInput) {
    if (current.storedImageUrl || !current.originalImageUrl) return { product: current, copyFailed: false };
    const form = new FormData(); form.set("remoteUrl", current.originalImageUrl);
    const response = await fetch("/api/products/images", { method: "POST", body: form });
    const data = await response.json() as { storedImageUrl?: string; thumbnailImageUrl?: string };
    return response.ok && data.storedImageUrl
      ? { product: { ...current, storedImageUrl: data.storedImageUrl, thumbnailImageUrl: data.thumbnailImageUrl }, copyFailed: false }
      : { product: current, copyFailed: true };
  }

  async function save(intent: "DRAFT" | "QUEUE") {
    setBusy("save"); setMessage(null);
    try {
      const { product: withImage, copyFailed } = await ensureOwnedImage(product);
      const parsed = productSaveInputSchema.safeParse(withImage);
      if (!parsed.success) throw new Error("Revise os campos obrigatórios e os valores informados.");
      const response = await fetch(productId ? `/api/products/${productId}` : "/api/products", { method: productId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: parsed.data, intent }) });
      const data = await response.json() as { queued?: boolean; warning?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setProduct(withImage);
      const savedMessage = data.warning ?? (data.queued ? "Produto salvo e adicionado à fila." : productId ? "Produto atualizado." : "Produto salvo como rascunho.");
      setMessage({ kind: copyFailed ? "error" : "success", text: copyFailed ? `${savedMessage} A foto está sendo exibida pela origem e ainda precisa ser copiada para o armazenamento próprio.` : savedMessage });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível salvar." }); }
    finally { setBusy(null); }
  }

  if (stage === "link") return (
    <section className="import-start content-card">
      <span className="import-icon">↗</span><h2>Cole o link do produto</h2><p>Aceitamos links comuns ou afiliados da Shopee, Mercado Livre e outras lojas.</p>
      <label>LINK DO PRODUTO<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." inputMode="url" /></label>
      {message && <div className={`form-message ${message.kind}`}>{message.text}</div>}
      <button className="primary large" onClick={importProduct} disabled={busy !== null}>{busy === "import" ? <><span className="spinner" /> Importando...</> : "Importar produto"}</button>
      <button className="text-button" onClick={() => { setProduct({ ...emptyProduct, sourceUrl: "https://example.invalid/produto", resolvedUrl: "https://example.invalid/produto", affiliateUrl: "https://example.invalid/produto" }); setStage("preview"); }}>Preencher manualmente</button>
      <small>Links locais, IPs privados e esquemas inseguros são bloqueados.</small>
    </section>
  );

  const imageUrl = product.storedImageUrl || product.originalImageUrl;
  const productPreview = renderMessageTemplate(DEFAULT_PRODUCT_TEMPLATE, { titulo: product.title, descricao: product.description, precoAtual: product.currentPrice, precoAnterior: product.oldPrice, cupom: product.couponCode, link: product.affiliateUrl, loja: product.storeName, marketplace: product.marketplace });
  const productLimit = validateProviderMessage(productPreview.text, "WHATSAPP", Boolean(imageUrl));
  return (
    <div className="product-editor-grid">
      <section className="product-preview content-card">
        <div className="preview-image">{imageUrl ? <Image src={imageUrl} alt={product.title || "Prévia do produto"} fill sizes="(max-width: 820px) 100vw, 34vw" unoptimized /> : <span>Sem imagem</span>}</div>
        <div className="affiliate-state"><i className={product.affiliateConfirmed ? "confirmed" : "pending"} />{product.affiliateConfirmed ? "Link afiliado confirmado" : "Link afiliado não confirmado"}</div>
        <h2>{product.title || "Título do produto"}</h2><p>{product.description || "A descrição aparecerá aqui."}</p>
        <div className="preview-prices"><del>{product.oldPrice ? `R$ ${product.oldPrice}` : ""}</del><strong>{product.currentPrice ? `R$ ${product.currentPrice}` : "Preço não informado"}</strong></div>
        <div className="message-bubble whatsapp"><pre>{productPreview.text}</pre></div><dl className="preview-details"><div><dt>WhatsApp / Telegram</dt><dd className={productLimit.valid ? "ok" : "over"}>{productLimit.characters} caracteres</dd></div><div><dt>Campos ausentes</dt><dd>{productPreview.missingFields.join(", ") || "Nenhum"}</dd></div><div><dt>Link final</dt><dd>{product.affiliateUrl}</dd></div></dl>
        {warnings.map((warning) => <div className="form-message warning" key={warning}>{warning}</div>)}
      </section>
      <section className="product-form content-card">
        <div className="form-section-heading"><div><span className="eyebrow">DADOS EDITÁVEIS</span><h2>Revise o produto</h2></div><button className="text-button" onClick={() => setStage("link")}>Trocar link</button></div>
        <div className="form-grid">
          <Field label="Título" value={product.title} onChange={(value) => update("title", value)} wide />
          <label>MARKETPLACE<select value={product.marketplace} onChange={(event) => update("marketplace", event.target.value as ProductSaveInput["marketplace"])}><option value="SHOPEE">Shopee</option><option value="MERCADO_LIVRE">Mercado Livre</option><option value="OTHER">Outro</option></select></label>
          <Field label="Loja" value={product.storeName ?? ""} onChange={(value) => update("storeName", value)} />
          <Field label="Preço anterior" value={product.oldPrice ?? ""} onChange={(value) => update("oldPrice", value)} />
          <Field label="Preço atual" value={product.currentPrice ?? ""} onChange={(value) => update("currentPrice", value)} />
          <Field label="Cupom" value={product.couponCode ?? ""} onChange={(value) => update("couponCode", value)} />
          <Field label="Link final" value={product.affiliateUrl} onChange={(value) => { update("affiliateUrl", value); update("affiliateConfirmed", false); }} wide />
          <label className="wide">DESCRIÇÃO<textarea value={product.description} onChange={(event) => update("description", event.target.value)} rows={4} /></label>
          <label className="wide">OBSERVAÇÕES INTERNAS<textarea value={product.internalNotes ?? ""} onChange={(event) => update("internalNotes", event.target.value)} rows={3} /></label>
          <label className="wide image-upload">IMAGEM DO PRODUTO<input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.avif" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0])} /><span>{busy === "image" ? "Processando imagem..." : "Substituir por uma arte própria (até 5 MB)"}</span></label>
        </div>
        {message && <div className={`form-message ${message.kind}`}>{message.text}</div>}
        <div className="editor-actions"><button className="secondary" onClick={() => void save("DRAFT")} disabled={busy !== null}>Salvar rascunho</button><button className="primary" onClick={() => void save("QUEUE")} disabled={busy !== null}>{busy === "save" ? "Salvando..." : "Adicionar à fila"}</button></div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={wide ? "wide" : undefined}>{label.toUpperCase()}<input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
