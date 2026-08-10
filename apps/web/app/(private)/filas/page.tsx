import { QueueManager } from "@/components/queues/QueueManager";
import { queueWorkspaceView } from "@/lib/queues/application";

export default async function QueuePage() {
  const data = await queueWorkspaceView();
  return (
    <QueueManager
      initialPaused={data.paused}
      channels={data.channels}
      publications={data.publications}
      initialQueues={data.queues}
    />
  );
}
