"use client";
import { useState } from "react";

type Item = {
  id: string;
  type: "TELEGRAM" | "WHATSAPP";
  status: string;
  configured: boolean;
  displayName: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
};
export function IntegrationsView({ initialItems, demoEnabled }: { initialItems: Item[]; demoEnabled: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [demoBehavior, setDemoBehavior] = useState<"SUCCESS" | "FAILURE" | "TIMEOUT">("SUCCESS");
  async function changeDemoBehavior(behavior: "SUCCESS" | "FAILURE" | "TIMEOUT") { setBusy("demo"); const response = await fetch("/api/demo", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ behavior }) }); setMessage(response.ok ? `Próximos envios simularão: ${behavior}.` : "Não foi possível alterar a simulação."); if (response.ok) setDemoBehavior(behavior); setBusy(""); }
  async function action(
    type: Item["type"],
    name: "CONNECT" | "DISCONNECT" | "REVOKE" | "TEST",
  ) {
    setBusy(`${type}-${name}`);
    setMessage("");
    const response = await fetch("/api/integrations/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, action: name }),
    });
    const data = (await response.json()) as { error?: string; status?: string };
    if (!response.ok) setMessage(data.error ?? "Ação não concluída.");
    else {
      setMessage("Ação concluída em modo seguro.");
      setItems((current) =>
        current.map((item) =>
          item.type === type
            ? { ...item, status: data.status ?? item.status }
            : item,
        ),
      );
    }
    setBusy("");
  }
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">PROVIDERS</span>
          <h1>Integrações</h1>
          <p>Estados e testes sem exibir credenciais.</p>
        </div>
        <span className="safe-mode">SEND_LIVE desativado</span>
      </header>
      {message && <p className="form-message warning">{message}</p>}
      {demoEnabled && <section className="content-card demo-controls"><div><span className="eyebrow">MODO DEMONSTRAÇÃO</span><h2>Comportamento do próximo envio</h2><p>A fila continua operando normalmente, sem qualquer chamada externa.</p></div><select aria-label="Comportamento da simulação" value={demoBehavior} disabled={Boolean(busy)} onChange={(event) => void changeDemoBehavior(event.target.value as "SUCCESS" | "FAILURE" | "TIMEOUT")}><option value="SUCCESS">Simular sucesso</option><option value="FAILURE">Simular falha</option><option value="TIMEOUT">Simular timeout</option></select></section>}
      <div className="integration-grid">
        {(["TELEGRAM", "WHATSAPP"] as const).map((type) => {
          const item = items.find((entry) => entry.type === type);
          return (
            <article className="content-card integration-card" key={type}>
              <div className="card-heading">
                <div>
                  <span className="eyebrow">{type}</span>
                  <h2>
                    {type === "TELEGRAM"
                      ? "Bot do Telegram"
                      : "WhatsApp Worker"}
                  </h2>
                </div>
                <span
                  className={`integration-status ${item?.status === "CONNECTED" ? "online" : ""}`}
                >
                  {item?.status ?? "NÃO CONFIGURADO"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Configuração</dt>
                  <dd>
                    {item?.configured ? "Configurado" : "Não configurado"}
                  </dd>
                </div>
                <div>
                  <dt>Grupo</dt>
                  <dd>{item?.displayName ?? "Não selecionado"}</dd>
                </div>
                <div>
                  <dt>Último teste</dt>
                  <dd>
                    {item?.lastHeartbeatAt
                      ? new Date(item.lastHeartbeatAt).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })
                      : "Nunca"}
                  </dd>
                </div>
                <div>
                  <dt>Último erro</dt>
                  <dd>{item?.lastError ?? "Nenhum"}</dd>
                </div>
              </dl>
              {type === "WHATSAPP" && item?.status === "WAITING_QR" && (
                <div className="qr-placeholder">
                  <strong>QR Code temporário</strong>
                  <span>
                    Disponibilizado pelo worker; expira automaticamente.
                  </span>
                </div>
              )}
              <div className="row-actions integration-actions">
                <button
                  disabled={Boolean(busy)}
                  onClick={() => action(type, "TEST")}
                >
                  Testar em mock
                </button>
                <button
                  disabled={Boolean(busy)}
                  onClick={() => action(type, "CONNECT")}
                >
                  Conectar
                </button>
                <button
                  disabled={Boolean(busy)}
                  onClick={() => action(type, "DISCONNECT")}
                >
                  Desconectar
                </button>
                {type === "WHATSAPP" && (
                  <button
                    className="danger-text"
                    disabled={Boolean(busy)}
                    onClick={() => action(type, "REVOKE")}
                  >
                    Revogar sessão
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="notice warning">
        <strong>Proteção ativa</strong>
        <span>
          Com SEND_LIVE=false, até integrações configuradas usam o provider
          simulado e não contatam serviços externos.
        </span>
      </p>
    </main>
  );
}
