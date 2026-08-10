"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ChannelRow = { id: string; name: string; platform: "WHATSAPP" | "TELEGRAM"; isActive: boolean };
type ConnectionState = "DISCONNECTED" | "WAITING_QR" | "CONNECTING" | "CONNECTED" | "ERROR" | "WORKER_OFFLINE";
type StatusResponse = {
  status: { state: ConnectionState; configured: boolean; lastError?: string };
  qrImage: string | null;
  qrExpiresAt: string | null;
  selectedGroup: { groupId: string; groupName: string } | null;
  error?: string;
};
type Group = { externalId: string; name: string; kind: "GROUP" };

const stateLabels: Record<ConnectionState, string> = {
  DISCONNECTED: "Desconectado",
  WAITING_QR: "Aguardando leitura do QR",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
  ERROR: "Conexão interrompida",
  WORKER_OFFLINE: "Worker indisponível",
};

export function ChannelManager({ channels }: { channels: ChannelRow[] }) {
  const router = useRouter();
  const [connection, setConnection] = useState<StatusResponse | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [workerOffline, setWorkerOffline] = useState(false);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/whatsapp/status", { cache: "no-store" });
    const data = await response.json() as StatusResponse;
    if (!response.ok) throw new Error(data.error ?? "Worker indisponível.");
    setWorkerOffline(false);
    setMessage((current) => current.startsWith("O worker do WhatsApp") ? "" : current);
    setConnection(data);
    if (data.status.state === "CONNECTED") {
      const groupsResponse = await fetch("/api/whatsapp/groups", { cache: "no-store" });
      const groupsData = await groupsResponse.json() as { groups?: Group[] };
      if (groupsResponse.ok) setGroups(groupsData.groups ?? []);
    } else setGroups([]);
  }, []);

  useEffect(() => {
    function handleRefreshError() {
      setWorkerOffline(true);
      setConnection(null);
      setGroups([]);
      setMessage("O worker do WhatsApp está offline. Inicie o worker para consultar a conexão.");
    }
    const initial = window.setTimeout(() => { void refreshStatus().catch(handleRefreshError); }, 0);
    const timer = window.setInterval(() => { void refreshStatus().catch(handleRefreshError); }, 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshStatus]);

  async function command(action: "connect" | "disconnect" | "revoke") {
    if (action === "revoke" && !window.confirm("Revogar a sessão exigirá ler um novo QR Code. Deseja continuar?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/whatsapp/${action}`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a ação.");
      setMessage(action === "connect" ? "Conexão iniciada. Leia o QR Code quando aparecer." : "Ação concluída.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }

  async function selectGroup(group: Group) {
    if (!window.confirm(`Autorizar somente o grupo “${group.name}”?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/whatsapp/select-group", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId: group.externalId, groupName: group.name }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível selecionar o grupo.");
      setMessage("Grupo autorizado. Os envios reais continuam desativados.");
      await refreshStatus();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível selecionar o grupo.");
    } finally {
      setBusy(false);
    }
  }

  const state = workerOffline ? "WORKER_OFFLINE" : connection?.status.state ?? "DISCONNECTED";
  return (
    <div className="page-content">
      <header className="page-heading"><div><span className="eyebrow">WHATSAPP</span><h1>Grupos</h1><p>Leia o QR Code e autorize somente o grupo que receberá as ofertas.</p></div></header>
      {message && <p className="form-message warning" role="status">{message}</p>}
      <section className="content-card whatsapp-control">
        <div className="whatsapp-status">
          <div><span className="eyebrow">ESTADO DA CONEXÃO</span><h2>{stateLabels[state]}</h2><p>{connection?.selectedGroup ? `Grupo autorizado: ${connection.selectedGroup.groupName}` : "Nenhum grupo autorizado."}</p></div>
          <span className={`status-pill ${state === "CONNECTED" ? "safe" : ""}`}>{stateLabels[state]}</span>
        </div>

        {workerOffline && (
          <div className="channel-create">
            <span className="import-icon">!</span><h2>Worker do WhatsApp indisponível</h2><p>A tela não consegue consultar a conexão enquanto o worker estiver parado. Nenhuma mensagem será enviada automaticamente.</p>
            <button className="secondary" onClick={() => { setMessage(""); void refreshStatus().catch(() => { setWorkerOffline(true); setMessage("O worker do WhatsApp ainda está offline."); }); }} disabled={busy}>Tentar novamente</button>
          </div>
        )}

        {!workerOffline && (state === "DISCONNECTED" || state === "ERROR") && (
          <div className="channel-create">
            <span className="import-icon">◎</span><h2>Conectar o WhatsApp</h2><p>A conexão acontece somente no worker. Nenhuma mensagem será enviada nesta etapa.</p>
            <button className="primary" onClick={() => void command("connect")} disabled={busy}>{busy ? "Iniciando..." : "Gerar QR Code"}</button>
          </div>
        )}

        {connection?.qrImage && state === "WAITING_QR" && (
          <div className="qr-panel">
            <Image unoptimized src={connection.qrImage} width={320} height={320} alt="QR Code temporário para conectar o WhatsApp" />
            <div><h2>Leia com o WhatsApp</h2><ol><li>Abra o WhatsApp no celular.</li><li>Entre em Aparelhos conectados.</li><li>Toque em Conectar um aparelho.</li><li>Aponte a câmera para este código.</li></ol><p>O código expira rapidamente e será atualizado sozinho.</p></div>
          </div>
        )}

        {state === "CONNECTING" && <div className="channel-create"><span className="loader" /><h2>Conectando...</h2><p>Aguarde a confirmação do WhatsApp.</p></div>}

        {state === "CONNECTED" && (
          <div className="group-picker">
            <div><span className="eyebrow">GRUPOS ENCONTRADOS</span><h2>Escolha um único grupo</h2><p>Conversas privadas e grupos não selecionados ficam bloqueados.</p></div>
            {groups.length ? groups.map((group) => {
              const selected = connection?.selectedGroup?.groupId === group.externalId;
              return <article className="channel-row" key={group.externalId}><div><h3>{group.name}</h3><p>{selected ? "Grupo autorizado" : "Não autorizado"}</p></div><button className={selected ? "secondary" : "primary"} disabled={busy || selected} onClick={() => void selectGroup(group)}>{selected ? "Selecionado ✓" : "Selecionar"}</button></article>;
            }) : <p className="empty-inline">Nenhum grupo encontrado nessa conta.</p>}
            <div className="editor-actions"><button className="secondary" disabled={busy} onClick={() => void command("disconnect")}>Desconectar</button><button className="danger" disabled={busy} onClick={() => void command("revoke")}>Revogar sessão</button></div>
          </div>
        )}
      </section>
      {channels.length > 0 && <p className="safe-note">Cadastro atual: {channels.filter((channel) => channel.platform === "WHATSAPP").map((channel) => channel.name).join(", ") || "nenhum"}. SEND_LIVE permanece false.</p>}
    </div>
  );
}
