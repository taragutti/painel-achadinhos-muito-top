import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardData } from "@/lib/operations/application";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";

export default async function DashboardPage() {
  await requireAuthenticatedAdmin();
  const data = await getDashboardData();
  return <DashboardView data={{ ...data, activeQueue: data.activeQueue ? { ...data.activeQueue, nextRunAt: data.activeQueue.nextRunAt?.toISOString() ?? null } : null, nextItem: data.nextItem ? { title: data.nextItem.publication.title ?? data.nextItem.publication.product?.title ?? "Publicação", queue: data.nextItem.queue.name, scheduledFor: data.nextItem.scheduledFor?.toISOString() ?? null, platforms: data.nextItem.publication.platforms } : null }} />;
}
