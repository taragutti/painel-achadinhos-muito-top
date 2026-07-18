"use client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
type Row = {
  id: string;
  createdAt: string;
  publicationId: string;
  publication: string;
  type: string;
  image: string | null;
  message: string;
  link: string | null;
  platform: string;
  group: string;
  status: string;
  attempt: number;
  providerMessageId: string | null;
  error: string | null;
  queueId: string;
  queue: string;
  queueItemId: string;
};
export function HistoryView({
  initialRows,
  products,
  queues,
}: {
  initialRows: Row[];
  products: Array<{ id: string; title: string }>;
  queues: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [feedback, setFeedback] = useState("");
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    router.push(`/historico?${next}`);
  };
  async function retry(row: Row) {
    const response = await fetch(`/api/queues/${row.queueId}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "RETRY_ITEM", itemId: row.queueItemId }),
    });
    setFeedback(
      response.ok
        ? "Item liberado para nova tentativa."
        : "Não foi possível liberar a tentativa.",
    );
    router.refresh();
  }
  async function duplicate(row: Row) {
    const response = await fetch(`/api/publications/${row.publicationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    setFeedback(
      response.ok
        ? "Publicação duplicada como rascunho."
        : "Não foi possível duplicar.",
    );
  }
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">HISTÓRICO IMUTÁVEL</span>
          <h1>Histórico</h1>
          <p>Conteúdo efetivamente usado em cada tentativa.</p>
        </div>
      </header>
      <section className="history-filters">
        <input
          type="date"
          aria-label="Data inicial"
          value={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
        />
        <input
          type="date"
          aria-label="Data final"
          value={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
        />
        <select
          aria-label="Plataforma"
          value={params.get("platform") ?? ""}
          onChange={(e) => update("platform", e.target.value)}
        >
          <option value="">Todas as plataformas</option>
          <option>WHATSAPP</option>
          <option>TELEGRAM</option>
        </select>
        <select
          aria-label="Status"
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">Todos os status</option>
          <option>SENT</option>
          <option>FAILED</option>
          <option>PROCESSING</option>
        </select>
        <select
          aria-label="Tipo"
          value={params.get("type") ?? ""}
          onChange={(e) => update("type", e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option>PRODUCT</option>
          <option>ART_LINK</option>
          <option>FREE_TEXT</option>
        </select>
        <select
          aria-label="Produto"
          value={params.get("productId") ?? ""}
          onChange={(e) => update("productId", e.target.value)}
        >
          <option value="">Todos os produtos</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Fila"
          value={params.get("queueId") ?? ""}
          onChange={(e) => update("queueId", e.target.value)}
        >
          <option value="">Todas as filas</option>
          {queues.map((queue) => (
            <option key={queue.id} value={queue.id}>
              {queue.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Buscar no conteúdo"
          placeholder="Buscar texto..."
          defaultValue={params.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") update("q", e.currentTarget.value);
          }}
        />
      </section>
      {feedback && (
        <p className="form-message success" role="status">
          {feedback}
        </p>
      )}
      {initialRows.length ? (
        <section className="delivery-history">
          {initialRows.map((row) => (
            <article className="content-card delivery-card" key={row.id}>
              {row.image && (
                <div className="delivery-image">
                  <Image
                    src={row.image}
                    alt={`Imagem enviada em ${row.publication}`}
                    fill
                    sizes="100px"
                    unoptimized
                  />
                </div>
              )}
              <div className="delivery-body">
                <div className="row-badges">
                  <span>{row.platform}</span>
                  <span className={row.status.toLowerCase()}>{row.status}</span>
                  <span>{row.type}</span>
                </div>
                <h2>{row.publication}</h2>
                <pre>{row.message}</pre>
                {row.link && (
                  <a href={row.link} target="_blank" rel="noreferrer">
                    {row.link}
                  </a>
                )}
                <dl>
                  <div>
                    <dt>Data</dt>
                    <dd>
                      {new Date(row.createdAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Grupo</dt>
                    <dd>{row.group}</dd>
                  </div>
                  <div>
                    <dt>Fila</dt>
                    <dd>{row.queue}</dd>
                  </div>
                  <div>
                    <dt>Tentativa</dt>
                    <dd>{row.attempt}</dd>
                  </div>
                  <div>
                    <dt>ID do provider</dt>
                    <dd>{row.providerMessageId ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Erro</dt>
                    <dd>{row.error ?? "—"}</dd>
                  </div>
                </dl>
                <div className="row-actions">
                  {row.status === "FAILED" && (
                    <button onClick={() => void retry(row)}>
                      Tentar novamente
                    </button>
                  )}
                  <button onClick={() => void duplicate(row)}>
                    Duplicar publicação
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="content-card empty-state">
          <span>◷</span>
          <h2>Nenhum registro encontrado</h2>
          <p>Ajuste os filtros ou aguarde o primeiro processamento mock.</p>
        </section>
      )}
    </main>
  );
}
