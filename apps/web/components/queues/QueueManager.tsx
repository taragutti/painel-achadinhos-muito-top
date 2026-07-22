"use client";
import { useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
type Channel = { id: string; name: string; platform: "WHATSAPP" | "TELEGRAM" };
type Publication = { id: string; title: string; type: string };
type QueueItem = {
  id: string;
  publicationId: string;
  title: string;
  type: string;
  status: string;
  priority: number;
  position: number;
  productId: string | null;
  scheduledFor: string | null;
  deliveries: Array<{
    status: string;
    channelId: string;
    attemptNumber: number;
  }>;
};
type Queue = {
  id: string;
  name: string;
  status: string;
  startsAt: string | null;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  itemsPerBatch: number;
  intervalMinutes: number;
  secondsBetweenItems: number;
  repeatEnabled: boolean;
  repeatCooldownHours: number;
  nextRunAt: string | null;
  channels: Channel[];
  items: QueueItem[];
};
const intervals = [1, 5, 10, 15, 20, 30, 60];
function buildEstimates(queue: Queue | undefined) {
  if (!queue) return new Map<string, string>();
  const base = queue.nextRunAt ? new Date(queue.nextRunAt) : new Date();
  return new Map(
    queue.items.map((item, index) => {
      const round = Math.floor(index / queue.itemsPerBatch);
      const inRound = index % queue.itemsPerBatch;
      return [
        item.id,
        new Date(
          base.getTime() +
            round * queue.intervalMinutes * 60000 +
            inRound * queue.secondsBetweenItems * 1000,
        ).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ];
    }),
  );
}
export function QueueManager({
  initialQueues,
  channels,
  publications,
  initialPaused,
}: {
  initialQueues: Queue[];
  channels: Channel[];
  publications: Publication[];
  initialPaused: boolean;
}) {
  const [queues, setQueues] = useState(initialQueues);
  const [selectedId, setSelectedId] = useState(initialQueues[0]?.id ?? "");
  const [globalPaused, setGlobalPausedState] = useState(initialPaused);
  const [message, setMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [draggedId, setDraggedId] = useState("");
  const selected = queues.find((queue) => queue.id === selectedId);
  const [form, setForm] = useState({
    name: "Fila principal",
    channelIds: channels.filter((channel) => channel.platform === "WHATSAPP").slice(0, 1).map((channel) => channel.id),
    startsAt: "",
    dailyStartTime: "08:00",
    dailyEndTime: "21:30",
    itemsPerBatch: 1,
    intervalMinutes: 20,
    customInterval: 20,
    secondsBetweenItems: 30,
    repeatEnabled: false,
    repeatCooldownHours: 24,
  });
  const [publicationId, setPublicationId] = useState(publications[0]?.id ?? "");
  async function refresh() {
    const response = await fetch("/api/queues");
    if (!response.ok) return;
    const data = (await response.json()) as {
      queues: Queue[];
      paused: boolean;
    };
    setQueues(data.queues);
    setGlobalPausedState(data.paused);
  }
  async function create() {
    const intervalMinutes =
      form.intervalMinutes === 0 ? form.customInterval : form.intervalMinutes;
    const response = await fetch("/api/queues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        intervalMinutes,
        startsAt: form.startsAt
          ? new Date(form.startsAt).toISOString()
          : undefined,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      queue?: { id: string };
    };
    if (!response.ok)
      return setMessage(data.error ?? "Não foi possível criar a fila.");
    setMessage("Fila criada pausada.");
    await refresh();
    if (data.queue) setSelectedId(data.queue.id);
  }
  async function action(
    actionName: string,
    itemId?: string,
    orderedItemIds?: string[],
    priority?: number,
  ) {
    if (!selected) return;
    const response = await fetch(`/api/queues/${selected.id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: actionName,
        itemId,
        orderedItemIds,
        priority,
      }),
    });
    const data = (await response.json()) as { error?: string };
    setMessage(
      response.ok ? "Fila atualizada." : (data.error ?? "Ação não concluída."),
    );
    if (response.ok) await refresh();
  }
  async function addItem() {
    if (!selected || !publicationId) return;
    const response = await fetch(`/api/queues/${selected.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicationId, priority: 0 }),
    });
    setMessage(
      response.ok
        ? "Item adicionado à fila."
        : "Não foi possível adicionar o item.",
    );
    if (response.ok) await refresh();
  }
  async function toggleGlobalPause() {
    const paused = !globalPaused;
    const response = await fetch("/api/queues/global-pause", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused }),
    });
    if (response.ok) {
      setGlobalPausedState(paused);
      setMessage(
        paused
          ? "Todas as publicações foram pausadas."
          : "Processamento global retomado.",
      );
    }
  }
  function dropOn(targetId: string) {
    if (!selected || !draggedId || targetId === draggedId) return;
    const ids = selected.items.map((item) => item.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void action("REORDER", undefined, ids);
    setDraggedId("");
  }
  function moveItem(itemId: string, direction: -1 | 1) {
    if (!selected) return;
    const ids = selected.items.map((item) => item.id);
    const from = ids.indexOf(itemId);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void action("REORDER", undefined, ids);
  }
  const estimates = buildEstimates(selected);
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ORQUESTRAÇÃO</span>
          <h1>Fila de postagem</h1>
          <p>Organize rodadas, horários e destinos com segurança.</p>
        </div>
        <button
          className={`pause-button ${globalPaused ? "paused" : ""}`}
          onClick={toggleGlobalPause}
        >
          {globalPaused ? "▶ RETOMAR TUDO" : "Ⅱ PAUSAR TUDO"}
        </button>
      </header>
      {message && (
        <p className="form-message warning" role="status">
          {message}
        </p>
      )}
      <section className="queue-layout">
        <aside className="content-card queue-sidebar">
          <h2>Suas filas</h2>
          {queues.map((queue) => (
            <button
              key={queue.id}
              className={selectedId === queue.id ? "active" : ""}
              onClick={() => setSelectedId(queue.id)}
            >
              <strong>{queue.name}</strong>
              <span>
                {queue.status} · {queue.items.length} itens
              </span>
            </button>
          ))}
          {queues.length === 0 && <p>Nenhuma fila criada.</p>}
        </aside>
        <div className="queue-main">
          {selected ? (
            <>
              <article className="content-card queue-summary">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">{selected.status}</span>
                    <h2>{selected.name}</h2>
                  </div>
                  <div className="row-actions">
                    <button
                      onClick={() =>
                        action(selected.status === "PAUSED" ? "START" : "PAUSE")
                      }
                    >
                      {selected.status === "PAUSED" ? "Iniciar" : "Pausar"}
                    </button>
                    {selected.status === "PAUSED" && (
                      <button onClick={() => action("RESUME")}>Retomar</button>
                    )}
                    <button onClick={() => action("COMPLETE")}>Encerrar</button>
                    <button
                      className="danger-text"
                      onClick={() => setConfirmClear(true)}
                    >
                      Limpar pendentes
                    </button>
                  </div>
                </div>
                <div className="queue-facts">
                  <span>{selected.itemsPerBatch} por rodada</span>
                  <span>A cada {selected.intervalMinutes} min</span>
                  <span>{selected.secondsBetweenItems}s entre itens</span>
                  <span>
                    {selected.dailyStartTime ?? "00:00"}–
                    {selected.dailyEndTime ?? "23:59"}
                  </span>
                  <span>
                    {selected.repeatEnabled
                      ? `Repete após ${selected.repeatCooldownHours}h`
                      : "Sem repetição"}
                  </span>
                </div>
                <div className="queue-add">
                  <select
                    value={publicationId}
                    onChange={(event) => setPublicationId(event.target.value)}
                  >
                    {publications.map((publication) => (
                      <option key={publication.id} value={publication.id}>
                        {publication.title} · {publication.type}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary"
                    onClick={addItem}
                    disabled={!publicationId}
                  >
                    Adicionar publicação
                  </button>
                </div>
              </article>
              <section className="queue-items">
                {selected.items.map((item) => (
                  <article
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropOn(item.id)}
                    className="content-card queue-item"
                  >
                    <span
                      className="drag-handle"
                      aria-label="Arraste para reordenar"
                    >
                      ⠿
                    </span>
                    <div>
                      <div className="row-badges">
                        <span>{item.type}</span>
                        <span className={item.status.toLowerCase()}>
                          {item.status}
                        </span>
                        {item.priority > 0 && (
                          <span className="confirmed">
                            PRIORIDADE {item.priority}
                          </span>
                        )}
                      </div>
                      <h3>{item.title}</h3>
                      <p>Estimativa: {estimates.get(item.id) ?? "—"}</p>
                    </div>
                    <div className="delivery-mini">
                      {selected.channels.map((channel) => (
                        <span key={channel.id}>
                          {channel.platform}:{" "}
                          {item.deliveries.find(
                            (delivery) =>
                              delivery.channelId === channel.id &&
                              delivery.status === "SENT",
                          )
                            ? "enviado"
                            : "pendente"}
                        </span>
                      ))}
                    </div>
                    <div className="row-actions">
                      {item.deliveries.some(
                        (delivery) => delivery.status === "SENT",
                      ) ? (
                        <Link href="/historico">Ver histórico</Link>
                      ) : (
                        <Link
                          href={`/publicacoes/nova?edit=${item.publicationId}`}
                        >
                          Editar publicação
                        </Link>
                      )}
                      <button aria-label="Mover item para cima" onClick={() => moveItem(item.id, -1)}>↑</button>
                      <button aria-label="Mover item para baixo" onClick={() => moveItem(item.id, 1)}>↓</button>
                      <button onClick={() => action("SET_PRIORITY", item.id, undefined, item.priority > 0 ? 0 : 10)}>
                        {item.priority > 0 ? "Remover prioridade" : "Priorizar"}
                      </button>
                      <button onClick={() => action("DUPLICATE_ITEM", item.id)}>
                        Duplicar
                      </button>
                      <button
                        onClick={() =>
                          action(
                            item.status === "PAUSED"
                              ? "RETRY_ITEM"
                              : "PAUSE_ITEM",
                            item.id,
                          )
                        }
                      >
                        {item.status === "PAUSED" ? "Retomar" : "Pausar"}
                      </button>
                      {item.status === "FAILED" && (
                        <button onClick={() => action("RETRY_ITEM", item.id)}>
                          Tentar novamente
                        </button>
                      )}
                      <button
                        className="danger-text"
                        onClick={() => action("REMOVE_ITEM", item.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <article className="content-card empty-state">
              <span>≋</span>
              <h2>Crie sua primeira fila</h2>
              <p>Ela começará pausada e não fará envios até ser iniciada.</p>
            </article>
          )}
        </div>
        <aside className="content-card queue-form">
          <span className="eyebrow">NOVA FILA</span>
          <h2>Configuração</h2>
          <div className="form-grid">
            <label className="wide">
              Nome
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <fieldset className="wide channel-checks">
              <legend>Canais</legend>
              {channels.map((channel) => (
                <label key={channel.id}>
                  <input
                    type="checkbox"
                    checked={form.channelIds.includes(channel.id)}
                    onChange={() =>
                      setForm({
                        ...form,
                        channelIds: form.channelIds.includes(channel.id)
                          ? form.channelIds.filter((id) => id !== channel.id)
                          : [...form.channelIds, channel.id],
                      })
                    }
                  />
                  {channel.name} · {channel.platform}
                </label>
              ))}
            </fieldset>
            <label className="wide">
              Início
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </label>
            <label>
              Janela diária
              <input
                type="time"
                value={form.dailyStartTime}
                onChange={(e) =>
                  setForm({ ...form, dailyStartTime: e.target.value })
                }
              />
            </label>
            <label>
              Encerramento
              <input
                type="time"
                value={form.dailyEndTime}
                onChange={(e) =>
                  setForm({ ...form, dailyEndTime: e.target.value })
                }
              />
            </label>
            <label>
              Itens por rodada
              <input
                type="number"
                min="1"
                max="10"
                value={form.itemsPerBatch}
                onChange={(e) =>
                  setForm({ ...form, itemsPerBatch: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Intervalo
              <select
                value={form.intervalMinutes}
                onChange={(e) =>
                  setForm({ ...form, intervalMinutes: Number(e.target.value) })
                }
              >
                {intervals.map((value) => (
                  <option key={value} value={value}>
                    {value} minuto{value > 1 ? "s" : ""}
                  </option>
                ))}
                <option value="0">Personalizado</option>
              </select>
            </label>
            {form.intervalMinutes === 0 && (
              <label>
                Minutos
                <input
                  type="number"
                  min="1"
                  value={form.customInterval}
                  onChange={(e) =>
                    setForm({ ...form, customInterval: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <label>
              Segundos entre itens
              <input
                type="number"
                min="1"
                value={form.secondsBetweenItems}
                onChange={(e) =>
                  setForm({
                    ...form,
                    secondsBetweenItems: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="wide default-check">
              <input
                type="checkbox"
                checked={form.repeatEnabled}
                onChange={(e) =>
                  setForm({ ...form, repeatEnabled: e.target.checked })
                }
              />
              Repetir itens
            </label>
            {form.repeatEnabled && (
              <label className="wide">
                Cooldown em horas
                <input
                  type="number"
                  min="1"
                  value={form.repeatCooldownHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      repeatCooldownHours: Number(e.target.value),
                    })
                  }
                />
              </label>
            )}
          </div>
          <button className="primary queue-create" onClick={create}>
            Criar fila pausada
          </button>
        </aside>
      </section>
      <ConfirmDialog
        open={confirmClear}
        title="Limpar itens pendentes?"
        description="Somente itens ainda não enviados serão retirados. O histórico e as entregas concluídas serão preservados."
        confirmLabel="Limpar pendentes"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void action("CLEAR_PENDING");
          setConfirmClear(false);
        }}
      />
    </main>
  );
}
