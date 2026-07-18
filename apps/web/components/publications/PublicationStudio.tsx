"use client";

import type { ProductSaveInput } from "@achadinhos/shared";
import { renderMessageTemplate, sanitizeMessageText, validateProviderMessage } from "@achadinhos/shared";
import Image from "next/image";
import { useState } from "react";
import { ProductImporterForm } from "@/components/products/ProductImporterForm";

type StudioType = "PRODUCT" | "ART_LINK" | "FREE_TEXT";
type TemplateOption = { id: string; name: string; platform: "WHATSAPP" | "TELEGRAM" | "BOTH"; content: string };
type InitialPublication = { id: string; type: "ART_LINK" | "FREE_TEXT"; title: string; message: string; link: string; coupon: string; mediaUrl: string; templateId: string; category: (typeof categories)[number]["value"]; platforms: Array<"WHATSAPP" | "TELEGRAM"> };
const categories = [{ value: "SIMPLE", label: "Texto simples" }, { value: "LINK", label: "Texto com link" }, { value: "NOTICE", label: "Aviso" }, { value: "COUPON", label: "Cupom" }, { value: "INVITATION", label: "Convite" }, { value: "GROUP_RULES", label: "Regras do grupo" }] as const;

export function PublicationStudio({ productId, initialProduct, initialPublication, templates }: { productId?: string; initialProduct?: ProductSaveInput; initialPublication?: InitialPublication; templates: TemplateOption[] }) {
  const [type, setType] = useState<StudioType>(initialPublication?.type ?? "PRODUCT");
  const [title, setTitle] = useState(initialPublication?.title ?? ""); const [message, setMessage] = useState(initialPublication?.message ?? ""); const [link, setLink] = useState(initialPublication?.link ?? "");
  const [coupon, setCoupon] = useState(initialPublication?.coupon ?? ""); const [mediaUrl, setMediaUrl] = useState(initialPublication?.mediaUrl ?? ""); const [templateId, setTemplateId] = useState(initialPublication?.templateId ?? "");
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>(initialPublication?.category ?? "SIMPLE");
  const [platforms, setPlatforms] = useState<Array<"WHATSAPP" | "TELEGRAM">>(initialPublication?.platforms ?? ["WHATSAPP", "TELEGRAM"]);
  const [previewPlatform, setPreviewPlatform] = useState<"WHATSAPP" | "TELEGRAM">("WHATSAPP");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");

  const rendered = renderMessageTemplate(message, { titulo: title, cupom: coupon, link });
  let finalText = rendered.text;
  if (coupon && !finalText.includes(coupon)) finalText += `\n\n🎟️ Cupom: ${coupon}`;
  if (link && !finalText.includes(link)) finalText += `\n\n${link}`;
  finalText = sanitizeMessageText(finalText).trim();
  const validation = validateProviderMessage(finalText, previewPlatform, Boolean(mediaUrl));

  function togglePlatform(platform: "WHATSAPP" | "TELEGRAM") { setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]); }
  function chooseTemplate(id: string) { setTemplateId(id); const selected = templates.find((item) => item.id === id); if (selected) setMessage(selected.content); }
  async function upload(file: File) { setBusy(true); const form = new FormData(); form.set("file", file); const response = await fetch("/api/products/images", { method: "POST", body: form }); const data = await response.json() as { storedImageUrl?: string; error?: string }; setBusy(false); if (data.storedImageUrl) setMediaUrl(data.storedImageUrl); else setNotice(data.error ?? "Imagem inválida."); }
  async function save(intent: "DRAFT" | "QUEUE") {
    setBusy(true); setNotice("");
    const response = await fetch(initialPublication ? `/api/publications/${initialPublication.id}` : "/api/publications", { method: initialPublication ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, title, customMessage: message, destinationLink: link, mediaUrl, couponCode: coupon, category, platforms, templateId: templateId || undefined, intent }) });
    const data = await response.json() as { error?: string; warning?: string; queued?: boolean }; setBusy(false);
    setNotice(data.error ?? data.warning ?? (data.queued ? "Publicação adicionada à fila." : "Publicação salva para publicar depois."));
  }

  return <main className="page-content publication-studio">
    <header className="page-heading"><div><span className="eyebrow">NOVA PUBLICAÇÃO</span><h1>O que você quer publicar?</h1><p>Prepare, confira nos dois canais e salve sem enviar nada agora.</p></div></header>
    <div className="publication-type-tabs" role="tablist">{([['PRODUCT','◇','Produto por link'],['ART_LINK','▧','Arte com link'],['FREE_TEXT','≡','Mensagem livre']] as const).map(([value, icon, label]) => <button type="button" role="tab" aria-selected={type === value} key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}><i>{icon}</i><span>{label}</span></button>)}</div>
    {type === "PRODUCT" ? <ProductImporterForm productId={productId} initialProduct={initialProduct} /> : <div className="composer-grid">
      <section className="content-card composer-form"><div className="form-grid">
        <label>MODELO<select value={templateId} onChange={(event) => chooseTemplate(event.target.value)}><option value="">Mensagem personalizada</option>{templates.filter((item) => item.platform === "BOTH" || platforms.includes(item.platform)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {type === "FREE_TEXT" && <label>CATEGORIA<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>}
        <label className="wide">TÍTULO<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título interno ou da publicação" /></label>
        <label className="wide">MENSAGEM<textarea rows={10} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva a mensagem ou escolha um modelo..." /></label>
        <label>LINK<input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." /></label><label>CUPOM<input value={coupon} onChange={(event) => setCoupon(event.target.value)} /></label>
        {type === "ART_LINK" && <label className="wide image-upload">ARTE<input type="file" accept=".jpg,.jpeg,.png,.webp,.avif" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])} /><span>{mediaUrl ? "Trocar arte" : "Enviar imagem"}</span></label>}
      </div>
      <fieldset className="platform-selector"><legend>DESTINOS</legend><label><input type="checkbox" checked={platforms.includes("WHATSAPP")} onChange={() => togglePlatform("WHATSAPP")} /> WhatsApp</label><label><input type="checkbox" checked={platforms.includes("TELEGRAM")} onChange={() => togglePlatform("TELEGRAM")} /> Telegram</label></fieldset>
      {notice && <div className="form-message success">{notice}</div>}<div className="editor-actions"><button className="secondary" disabled={busy} onClick={() => void save("DRAFT")}>Salvar para depois</button><button className="primary" disabled={busy || !platforms.length} onClick={() => void save("QUEUE")}>Adicionar à fila</button></div></section>
      <section className="content-card channel-preview"><div className="preview-tabs"><button className={previewPlatform === "WHATSAPP" ? "active" : ""} onClick={() => setPreviewPlatform("WHATSAPP")}>WhatsApp</button><button className={previewPlatform === "TELEGRAM" ? "active" : ""} onClick={() => setPreviewPlatform("TELEGRAM")}>Telegram</button></div>
        {mediaUrl && <div className="message-media"><Image src={mediaUrl} alt="Arte da publicação" fill sizes="420px" unoptimized /></div>}
        <div className={`message-bubble ${previewPlatform.toLowerCase()}`}><pre>{finalText || "Sua mensagem aparecerá aqui."}</pre>{link && <a href={link} target="_blank" rel="noreferrer">{link}</a>}</div>
        <dl className="preview-details"><div><dt>Caracteres</dt><dd className={validation.valid ? "ok" : "over"}>{validation.characters} / {validation.maximum}</dd></div><div><dt>Campos ausentes</dt><dd>{rendered.missingFields.length ? rendered.missingFields.join(", ") : "Nenhum"}</dd></div><div><dt>Link final</dt><dd>{link || "Não informado"}</dd></div></dl>
      </section></div>}
  </main>;
}
