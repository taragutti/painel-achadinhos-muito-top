"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
type PublicationRow = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  platforms: string[];
  customMessage: string | null;
  createdAt: string;
  attempts: number;
  queueName: string | null;
  scheduledFor: string | null;
};
export function PublicationsView({
  initialPublications,
}: {
  initialPublications: PublicationRow[];
}) {
  const router = useRouter();
  const [removeId, setRemoveId] = useState<string>();
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "archive" | "remove-queue";
  }>();
  const [notice, setNotice] = useState("");
  async function action(id: string, name: string) {
    const response = await fetch(`/api/publications/${id}`, {
      method: name === "delete" ? "DELETE" : "PATCH",
      headers: { "content-type": "application/json" },
      body: name === "delete" ? undefined : JSON.stringify({ action: name }),
    });
    const data = (await response.json()) as {
      error?: string;
      warning?: string;
    };
    setNotice(
      data.error ??
        data.warning ??
        (name === "test"
          ? "Teste simulado. Nenhuma mensagem foi enviada."
          : "Ação concluída."),
    );
    setRemoveId(undefined);
    setConfirmAction(undefined);
    router.refresh();
  }
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">CONTEÚDO</span>
          <h1>Publicações</h1>
          <p>Edite, reutilize, teste e acompanhe seu conteúdo.</p>
        </div>
        <Link className="primary action-link" href="/publicacoes/nova">
          + Nova publicação
        </Link>
      </header>
      {notice && <div className="form-message success">{notice}</div>}
      {!initialPublications.length ? (
        <section className="content-card empty-state">
          <span>↗</span>
          <h2>Nenhuma publicação criada</h2>
          <p>Crie produto, arte com link ou mensagem livre.</p>
        </section>
      ) : (
        <section className="publication-list">
          {initialPublications.map((item) => (
            <article className="content-card publication-row" key={item.id}>
              <div>
                <span className="eyebrow">{typeLabel(item.type)}</span>
                <h2>
                  {item.title ||
                    item.customMessage?.slice(0, 70) ||
                    "Sem título"}
                </h2>
                <p>
                  {item.platforms.join(" + ") || "Sem destino"} • {item.status}
                  {" • fila: "}
                  {item.queueName ?? "nenhuma"}
                  {" • estimativa: "}
                  {item.scheduledFor
                    ? new Date(item.scheduledFor).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "—"}
                </p>
              </div>
              <div className="row-actions">
                <Link href={`/publicacoes/nova?publicationId=${item.id}`}>
                  Editar
                </Link>
                <button onClick={() => void action(item.id, "duplicate")}>
                  Duplicar
                </button>
                <button
                  onClick={() =>
                    setConfirmAction({ id: item.id, action: "archive" })
                  }
                >
                  Arquivar
                </button>
                <button onClick={() => void action(item.id, "queue")}>
                  Adicionar à fila
                </button>
                {item.queueName && (
                  <button
                    onClick={() =>
                      setConfirmAction({ id: item.id, action: "remove-queue" })
                    }
                  >
                    Remover da fila
                  </button>
                )}
                <button onClick={() => void action(item.id, "test")}>
                  Publicar em teste
                </button>
                <Link href={`/historico?publicationId=${item.id}`}>
                  Histórico
                </Link>
                <button
                  className="danger-text"
                  onClick={() => setRemoveId(item.id)}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {removeId && (
        <ConfirmDialog
          open
          title="Excluir publicação?"
          description="A publicação será excluída logicamente e o histórico será preservado."
          confirmLabel="Excluir"
          onCancel={() => setRemoveId(undefined)}
          onConfirm={() => void action(removeId, "delete")}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          open
          title={
            confirmAction.action === "archive"
              ? "Arquivar publicação?"
              : "Remover publicação da fila?"
          }
          description={
            confirmAction.action === "archive"
              ? "A publicação deixará de ficar disponível para novas filas. O histórico será preservado."
              : "Somente os itens pendentes serão cancelados. Entregas e histórico não serão alterados."
          }
          confirmLabel={
            confirmAction.action === "archive" ? "Arquivar" : "Remover da fila"
          }
          onCancel={() => setConfirmAction(undefined)}
          onConfirm={() => void action(confirmAction.id, confirmAction.action)}
        />
      )}
    </main>
  );
}
function typeLabel(type: string) {
  return type === "PRODUCT"
    ? "Produto por link"
    : type === "ART_LINK"
      ? "Arte com link"
      : "Mensagem livre";
}
