import { PublicationsView } from "@/components/publications/PublicationsView";
import { listPublications } from "@/lib/publications/application";
export const dynamic = "force-dynamic";
export default async function PublicationsPage() { const rows = await listPublications(); return <PublicationsView initialPublications={rows.map((item) => ({ id: item.id, title: item.title, type: item.type, status: item.status, platforms: item.platforms, customMessage: item.customMessage, createdAt: item.createdAt.toISOString(), attempts: item.attempts.length, queueName: item.queueItems[0]?.queue.name ?? null, scheduledFor: item.queueItems[0]?.scheduledFor?.toISOString() ?? null }))} />; }
