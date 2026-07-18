import {
  getPrisma,
  OperationalRepository,
  QueueRepository,
  type HistoryFilters,
} from "@achadinhos/database";
import { operationalSettingsSchema } from "@achadinhos/shared";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";
export const defaultSettings = {
  panelName: "Painel Achadinhos Muito Top",
  timezone: "America/Sao_Paulo" as const,
  defaultIntervalMinutes: 30,
  defaultItemsPerBatch: 1,
  defaultSecondsBetweenItems: 30,
  dailyStartTime: "08:00",
  dailyEndTime: "22:00",
  repeatEnabled: false,
  repeatCooldownHours: 24,
  defaultChannelId: "",
  defaultTemplateId: "",
  maxAttempts: 3,
};
function repository() {
  return new OperationalRepository(getPrisma());
}
function todayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const localAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  const offset = localAsUtc - now.getTime();
  const start = new Date(
    Date.UTC(value("year"), value("month") - 1, value("day")) - offset,
  );
  return { start, end: new Date(start.getTime() + 86400000) };
}
export async function getDashboardData() {
  await requireAuthenticatedAdmin();
  const bounds = todayBounds();
  const [data, paused] = await Promise.all([
    repository().dashboard(bounds.start, bounds.end),
    new QueueRepository(getPrisma()).isGloballyPaused(),
  ]);
  return { ...data, paused };
}
export async function listHistory(filters: HistoryFilters) {
  await requireAuthenticatedAdmin();
  return repository().history(filters);
}
export async function getHistoryOptions() {
  await requireAuthenticatedAdmin();
  return repository().listHistoryOptions();
}
export async function getOperationalSettings() {
  await requireAuthenticatedAdmin();
  const [setting, options] = await Promise.all([
    repository().getSetting("operational.settings"),
    repository().listSettingsOptions(),
  ]);
  const parsed = operationalSettingsSchema.safeParse(setting?.value);
  return {
    settings: parsed.success ? parsed.data : defaultSettings,
    channels: options[0],
    templates: options[1],
  };
}
export async function saveOperationalSettings(value: unknown) {
  const settings = operationalSettingsSchema.parse(value);
  await repository().saveSetting("operational.settings", settings);
  return settings;
}
