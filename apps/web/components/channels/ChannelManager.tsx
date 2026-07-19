"use client";

import { channelInputSchema } from "@achadinhos/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ChannelRow = { id: string; name: string; platform: "WHATSAPP" | "TELEGRAM"; isActive: boolean };

export function ChannelManager({ channels }: { channels: ChannelRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("🔥 OFERTAS E CUPONS MUITO TOP 🔥 — simulação");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function create() {
    const input = channelInputSchema.safeParse({ name, platform: "WHATSAPP" });
    if (!input.success) return setMessage("Informe um nome para o canal.");
    setBusy(true); setMessage("");
    const response = await fetch("/api/channels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input.data) });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Não foi possível criar o canal.");
    setMessage("Canal de teste criado. Nenhuma mensagem real será enviada.");
    router.refresh();
  }

  return (
    <main className="page-content">
      <header className="page-heading"><div><span className="eyebrow">PAINEL ACHADINHOS</span><h1>Canais</h1><p>Gerencie os destinos de WhatsApp e Telegram.</p></div></header>
      {message && <p className="form-message warning" role="status">{message}</p>}
      <section className="content-card">
        {channels.length ? channels.map((channel) => (
          <article className="channel-row" key={channel.id}>
            <div><span className="eyebrow">{channel.platform}</span><h2>{channel.name}</h2><p>{channel.isActive ? "Ativo em modo simulado" : "Inativo"}</p></div>
            <span className="status-pill safe">SIMULAÇÃO</span>
          </article>
        )) : (
          <div className="channel-create">
            <span className="import-icon">◎</span><h2>Nenhum canal conectado</h2><p>Crie um destino simulado para testar a fila sem contatar o WhatsApp.</p>
            <label>NOME DO CANAL<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
            <button className="primary" onClick={() => void create()} disabled={busy}>{busy ? "Criando..." : "Criar WhatsApp de teste"}</button>
          </div>
        )}
      </section>
    </main>
  );
}
