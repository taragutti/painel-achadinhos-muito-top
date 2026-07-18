"use client";
import Link from "next/link";
import { useState } from "react";
type Row = {
  id: string;
  queue: string;
  title: string;
  scheduledFor: string | null;
  status: string;
  platforms: string[];
};
type View = "LIST" | "TODAY" | "UPCOMING" | "COMPLETED" | "FAILED";
export function ScheduleView({ rows }: { rows: Row[] }) {
  const [view, setView] = useState<View>("LIST");
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const visible = rows
    .filter((row) => {
      const date = row.scheduledFor
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
          }).format(new Date(row.scheduledFor))
        : "";
      if (view === "TODAY") return date === today;
      if (view === "UPCOMING")
        return (
          row.scheduledFor &&
          new Date(row.scheduledFor) >= now &&
          !["COMPLETED", "FAILED"].includes(row.status)
        );
      if (view === "COMPLETED") return row.status === "COMPLETED";
      if (view === "FAILED") return row.status === "FAILED";
      return true;
    })
    .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">AMERICA/SAO_PAULO</span>
          <h1>Agendamentos</h1>
          <p>Lista operacional de rodadas e entregas.</p>
        </div>
        <Link className="primary" href="/filas">
          Gerenciar filas
        </Link>
      </header>
      <nav className="schedule-tabs" aria-label="Visualização de agendamentos">
        {(["LIST", "TODAY", "UPCOMING", "COMPLETED", "FAILED"] as const).map(
          (item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              {
                {
                  LIST: "Lista",
                  TODAY: "Hoje",
                  UPCOMING: "Próximos envios",
                  COMPLETED: "Concluídos",
                  FAILED: "Falhas",
                }[item]
              }
            </button>
          ),
        )}
      </nav>
      {visible.length ? (
        <section className="history-list">
          {visible.map((row) => (
            <article className="content-card" key={row.id}>
              <div>
                <strong>{row.title}</strong>
                <span>
                  {row.queue} · {row.platforms.join(" + ")}
                </span>
              </div>
              <span className={`queue-tag ${row.status.toLowerCase()}`}>
                {row.status}
              </span>
              <time>
                {row.scheduledFor
                  ? new Date(row.scheduledFor).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })
                  : "Aguardando cálculo"}
              </time>
            </article>
          ))}
        </section>
      ) : (
        <section className="content-card empty-state">
          <span>◷</span>
          <h2>Nenhum agendamento nesta visualização</h2>
          <p>Escolha outra categoria ou prepare uma fila.</p>
        </section>
      )}
    </main>
  );
}
