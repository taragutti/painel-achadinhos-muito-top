import { ScheduleView } from "@/components/schedules/ScheduleView";
import { queueWorkspace } from "@/lib/queues/application";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";
export default async function SchedulesPage() {
  await requireAuthenticatedAdmin();
  const { queues } = await queueWorkspace();
  return (
    <ScheduleView
      rows={queues.flatMap((queue) =>
        queue.items.map((item) => ({
          id: item.id,
          queue: queue.name,
          title:
            item.publication.title ??
            item.publication.product?.title ??
            "Publicação sem título",
          scheduledFor: item.scheduledFor?.toISOString() ?? null,
          status: item.status,
          platforms: item.publication.platforms,
        })),
      )}
    />
  );
}
