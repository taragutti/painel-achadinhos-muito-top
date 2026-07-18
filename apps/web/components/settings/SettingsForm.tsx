"use client";
import { useState } from "react";
type Settings = {
  panelName: string;
  timezone: "America/Sao_Paulo";
  defaultIntervalMinutes: number;
  defaultItemsPerBatch: number;
  defaultSecondsBetweenItems: number;
  dailyStartTime: string;
  dailyEndTime: string;
  repeatEnabled: boolean;
  repeatCooldownHours: number;
  defaultChannelId?: string;
  defaultTemplateId?: string;
  maxAttempts: number;
};
export function SettingsForm({
  initialSettings,
  channels,
  templates,
}: {
  initialSettings: Settings;
  channels: Array<{ id: string; name: string; platform: string }>;
  templates: Array<{ id: string; name: string; platform: string }>;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    setFeedback(
      response.ok ? "Configurações salvas." : "Revise os valores informados.",
    );
    setSaving(false);
  }
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">PREFERÊNCIAS OPERACIONAIS</span>
          <h1>Configurações</h1>
          <p>Padrões usados na preparação de novas filas.</p>
        </div>
      </header>
      <section className="content-card settings-card">
        <div className="form-grid">
          <label className="wide">
            Nome do painel
            <input
              value={settings.panelName}
              onChange={(e) =>
                setSettings({ ...settings, panelName: e.target.value })
              }
            />
          </label>
          <label>
            Fuso horário
            <select value={settings.timezone} disabled>
              <option>America/Sao_Paulo</option>
            </select>
          </label>
          <label>
            Intervalo padrão (min)
            <input
              type="number"
              min="1"
              value={settings.defaultIntervalMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultIntervalMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Itens por rodada
            <input
              type="number"
              min="1"
              max="10"
              value={settings.defaultItemsPerBatch}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultItemsPerBatch: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Segundos entre itens
            <input
              type="number"
              min="1"
              value={settings.defaultSecondsBetweenItems}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultSecondsBetweenItems: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Horário inicial
            <input
              type="time"
              value={settings.dailyStartTime}
              onChange={(e) =>
                setSettings({ ...settings, dailyStartTime: e.target.value })
              }
            />
          </label>
          <label>
            Horário final
            <input
              type="time"
              value={settings.dailyEndTime}
              onChange={(e) =>
                setSettings({ ...settings, dailyEndTime: e.target.value })
              }
            />
          </label>
          <label className="default-check wide">
            <input
              type="checkbox"
              checked={settings.repeatEnabled}
              onChange={(e) =>
                setSettings({ ...settings, repeatEnabled: e.target.checked })
              }
            />
            Repetição padrão
          </label>
          <label>
            Bloqueio de repetição (h)
            <input
              type="number"
              min="1"
              value={settings.repeatCooldownHours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  repeatCooldownHours: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Limite de tentativas
            <input
              type="number"
              min="1"
              max="3"
              value={settings.maxAttempts}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxAttempts: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Canal padrão
            <select
              value={settings.defaultChannelId ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, defaultChannelId: e.target.value })
              }
            >
              <option value="">Nenhum</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} · {channel.platform}
                </option>
              ))}
            </select>
          </label>
          <label>
            Template padrão
            <select
              value={settings.defaultTemplateId ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, defaultTemplateId: e.target.value })
              }
            >
              <option value="">Nenhum</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.platform}
                </option>
              ))}
            </select>
          </label>
        </div>
        {feedback && (
          <p
            className={`form-message ${feedback.startsWith("Revise") ? "error" : "success"}`}
            role="status"
          >
            {feedback}
          </p>
        )}
        <div className="editor-actions">
          <button
            className="primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </section>
    </main>
  );
}
