"use client";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuickOfferForm } from "./QuickOfferForm";
type DashboardData = {
  paused: boolean;
  integrations: Array<{
    type: string;
    status: string;
    displayName: string | null;
  }>;
  whatsappChannel: { id: string; name: string } | null;
  activeQueue: {
    id: string;
    name: string;
    status: string;
    intervalMinutes: number;
    dailyStartTime: string | null;
    dailyEndTime: string | null;
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
  async function startQueue() {
    if (!data.activeQueue) return;
    const response = await fetch(
      `/api/queues/${data.activeQueue.id}/actions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "START" }),
      },
    );
    if (response.ok) {
      setFeedback("Automação ativada. A fila seguirá o horário configurado.");
      window.location.reload();
    } else {
      setFeedback("Não foi possível ativar a automação.");
    }
  }
  const whatsapp = integration("WHATSAPP");
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">ACHADINHOS MUITO TOP</span>
          <h1>Postagens automáticas</h1>
          <p>Da Shopee para o seu grupo do WhatsApp.</p>
        </div>
        <div className="dashboard-actions">
          <Link className="secondary" href="/canais">
            Configurar grupo
          </Link>
          {data.activeQueue?.status === "PAUSED" && (
            <button className="primary" onClick={() => void startQueue()}>
              ▶ Ativar automação
            </button>
          )}
          <button
            className="pause-button"
            disabled={paused || data.activeQueue?.status === "PAUSED"}
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
      <QuickOfferForm />
      <section className="automation-status-grid">
        <article className="content-card automation-status-card">
          <span
            className={`status-dot ${whatsapp?.status === "CONNECTED" ? "" : "offline"}`}
          />
          <div>
            <span className="eyebrow">GRUPO DO WHATSAPP</span>
            <strong>
              {data.whatsappChannel?.name ??
                whatsapp?.displayName ??
                "Nenhum grupo selecionado"}
            </strong>
            <small>{whatsapp?.status ?? "NÃO CONFIGURADO"}</small>
          </div>
          <Link href="/canais">Configurar</Link>
        </article>
        <article className="content-card channel-status-card">
          <span
            className={`status-dot ${data.activeQueue && !paused ? "" : "offline"}`}
          />
          <div>
            <span className="eyebrow">AUTOMAÇÃO</span>
            <strong>
              {paused
                ? "Pausada"
                : data.activeQueue?.status === "PAUSED"
                  ? "Pausada"
                  : data.activeQueue
                  ? "Ativa"
                  : "Aguardando início"}
            </strong>
            <small>
              {data.activeQueue
                ? `1 postagem a cada ${data.activeQueue.intervalMinutes} minutos`
                : "A fila começa pausada por segurança"}
            </small>
          </div>
        </article>
        <article className="content-card channel-status-card">
          <span className="schedule-mark">◷</span>
          <div>
            <span className="eyebrow">HORÁRIO DIÁRIO</span>
            <strong>
              {data.activeQueue?.dailyStartTime ?? "08:00"} às{" "}
              {data.activeQueue?.dailyEndTime ?? "22:00"}
            </strong>
            <small>Horário de Brasília · todos os dias</small>
          </div>
        </article>
      </section>
      <section className="simple-metrics">
        {[
          { label: "Na fila", value: data.pending },
          { label: "Enviadas hoje", value: data.sentToday },
          { label: "Falhas hoje", value: data.failedToday },
        ].map((metric) => (
          <article key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
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
