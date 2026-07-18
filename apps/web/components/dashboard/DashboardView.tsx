"use client";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
type DashboardData = {
  paused: boolean;
  integrations: Array<{
    type: string;
    status: string;
    displayName: string | null;
  }>;
  activeQueue: {
    name: string;
    status: string;
    intervalMinutes: number;
    nextRunAt: string | null;
  } | null;
  nextItem: {
    title: string;
    queue: string;
    scheduledFor: string | null;
    platforms: string[];
  } | null;
  products: number;
  pending: number;
  sentToday: number;
  failedToday: number;
  sentByPlatform: Array<{ platform: string; total: number }>;
};
export function DashboardView({ data }: { data: DashboardData }) {
  const [paused, setPaused] = useState(data.paused);
  const [confirming, setConfirming] = useState<"pause" | "resume" | null>(null);
  const [feedback, setFeedback] = useState("");
  const integration = (type: string) =>
    data.integrations.find((item) => item.type === type);
  const total = (type: string) =>
    data.sentByPlatform
      .filter((item) => item.platform === type)
      .reduce((sum, item) => sum + item.total, 0);
  async function setGlobalPause(next: boolean) {
    const response = await fetch("/api/queues/global-pause", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: next }),
    });
    if (response.ok) {
      setPaused(next);
      setFeedback(
        next
          ? "Todas as publicações foram pausadas."
          : "Processamento retomado.",
      );
    } else setFeedback("Não foi possível alterar a operação.");
    setConfirming(null);
  }
  const metrics = [
    { label: "PRODUTOS", value: data.products, detail: "cadastrados" },
    { label: "PENDENTES", value: data.pending, detail: "publicações" },
    { label: "REALIZADAS HOJE", value: data.sentToday, detail: "entregas" },
    { label: "FALHAS HOJE", value: data.failedToday, detail: "entregas" },
    {
      label: "WHATSAPP ENVIADO",
      value: total("WHATSAPP"),
      detail: "total histórico",
    },
    {
      label: "TELEGRAM ENVIADO",
      value: total("TELEGRAM"),
      detail: "total histórico",
    },
  ];
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO EM TEMPO REAL</span>
          <h1>Dashboard</h1>
          <p>Resumo de filas, integrações e entregas.</p>
        </div>
        <div className="dashboard-actions">
          <Link className="primary" href="/publicacoes/nova">
            + Nova publicação
          </Link>
          <Link className="secondary" href="/filas">
            Abrir fila
          </Link>
          <button
            className="pause-button"
            disabled={paused}
            onClick={() => setConfirming("pause")}
          >
            Ⅱ Pausar tudo
          </button>
          <button
            className="secondary"
            disabled={!paused}
            onClick={() => setConfirming("resume")}
          >
            ▶ Retomar
          </button>
        </div>
      </header>
      {feedback && (
        <p
          className={`form-message ${feedback.startsWith("Não") ? "error" : "success"}`}
          role="status"
        >
          {feedback}
        </p>
      )}
      {paused && (
        <div className="notice warning">
          <strong>Operação pausada</strong>
          <span>Nenhum item será processado até a retomada.</span>
        </div>
      )}
      <section className="channel-status-grid">
        {["WHATSAPP", "TELEGRAM"].map((type) => {
          const item = integration(type);
          return (
            <article className="content-card channel-status-card" key={type}>
              <span
                className={`status-dot ${item?.status === "CONNECTED" ? "" : "offline"}`}
              />
              <div>
                <span className="eyebrow">{type}</span>
                <strong>{item?.status ?? "NÃO CONFIGURADO"}</strong>
                <small>{item?.displayName ?? "Nenhum grupo selecionado"}</small>
              </div>
            </article>
          );
        })}
        <article className="content-card channel-status-card">
          <span className={`status-dot ${data.activeQueue ? "" : "offline"}`} />
          <div>
            <span className="eyebrow">FILA ATIVA</span>
            <strong>{data.activeQueue?.name ?? "Nenhuma"}</strong>
            <small>
              {data.activeQueue
                ? `${data.activeQueue.intervalMinutes} min entre rodadas`
                : "Crie ou retome uma fila"}
            </small>
          </div>
        </article>
      </section>
      <section className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="content-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">PRÓXIMO ENVIO</span>
              <h2>{data.nextItem?.title ?? "Nenhum envio previsto"}</h2>
            </div>
            <span className="time-badge">
              {data.nextItem?.scheduledFor
                ? new Date(data.nextItem.scheduledFor).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })
                : "—"}
            </span>
          </div>
          {data.nextItem && (
            <div className="publication-preview">
              <span className="product-placeholder">◇</span>
              <div>
                <strong>{data.nextItem.queue}</strong>
                <p>{data.nextItem.platforms.join(" + ")}</p>
              </div>
              <span className="queue-tag">AGENDADO</span>
            </div>
          )}
        </article>
        <article className="content-card interval-card">
          <span className="eyebrow">PRÓXIMA RODADA</span>
          <h2>
            {data.activeQueue?.nextRunAt
              ? new Date(data.activeQueue.nextRunAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })
              : "Sem previsão"}
          </h2>
          <p>{data.activeQueue?.status ?? "PAUSADA"}</p>
        </article>
      </section>
      <ConfirmDialog
        open={Boolean(confirming)}
        title={
          confirming === "pause"
            ? "Pausar todas as publicações?"
            : "Retomar todas as publicações?"
        }
        description={
          confirming === "pause"
            ? "Itens agendados serão preservados e o worker deixará de iniciar novos envios."
            : "Os itens voltarão a ser processados conforme as janelas configuradas."
        }
        confirmLabel={confirming === "pause" ? "Pausar tudo" : "Retomar"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void setGlobalPause(confirming === "pause")}
      />
    </>
  );
}
