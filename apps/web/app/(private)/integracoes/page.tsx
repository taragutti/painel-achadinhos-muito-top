import { IntegrationsView } from "@/components/integrations/IntegrationsView";
import { listIntegrations } from "@/lib/integrations/application";
export default async function IntegrationsPage() { const items = await listIntegrations(); return <IntegrationsView demoEnabled={process.env.DEMO_MODE === "true"} initialItems={items.map((item) => ({ ...item, type: item.type as "TELEGRAM" | "WHATSAPP", lastHeartbeatAt: item.lastHeartbeatAt?.toISOString() ?? null, updatedAt: item.updatedAt.toISOString() }))} />; }
