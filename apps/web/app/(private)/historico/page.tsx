import { HistoryView } from "@/components/history/HistoryView";
import { getHistoryOptions, listHistory } from "@/lib/operations/application";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuthenticatedAdmin();
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined;
  const deliveries = await listHistory({
    from: value("from")
      ? new Date(`${value("from")}T00:00:00-03:00`)
      : undefined,
    to: value("to") ? new Date(`${value("to")}T23:59:59-03:00`) : undefined,
    platform: ["WHATSAPP", "TELEGRAM"].includes(value("platform") ?? "")
      ? (value("platform") as "WHATSAPP" | "TELEGRAM")
      : undefined,
    status: ["SENT", "FAILED", "PROCESSING"].includes(value("status") ?? "")
      ? (value("status") as "SENT" | "FAILED" | "PROCESSING")
      : undefined,
    type: ["PRODUCT", "ART_LINK", "FREE_TEXT"].includes(value("type") ?? "")
      ? (value("type") as "PRODUCT" | "ART_LINK" | "FREE_TEXT")
      : undefined,
    productId: value("productId"),
    text: value("q"),
    queueId: value("queueId"),
  });
  const [products, queues] = await getHistoryOptions();
  return (
    <HistoryView
      products={products}
      queues={queues}
      initialRows={deliveries.map((delivery) => ({
        id: delivery.id,
        createdAt: delivery.createdAt.toISOString(),
        publicationId: delivery.queueItem.publicationId,
        publication:
          delivery.queueItem.publication.title ??
          delivery.queueItem.publication.product?.title ??
          delivery.queueItem.publication.type,
        type: delivery.queueItem.publication.type,
        image: delivery.mediaUrlSnapshot,
        message: delivery.messageSnapshot,
        link:
          delivery.queueItem.publication.destinationLink ??
          delivery.queueItem.publication.product?.affiliateUrl ??
          null,
        platform: delivery.channel.platform,
        group: delivery.channel.name,
        status: delivery.status,
        attempt: delivery.attemptNumber,
        providerMessageId: delivery.providerMessageId,
        error: delivery.errorMessage,
        queueId: delivery.queueItem.queue.id,
        queue: delivery.queueItem.queue.name,
        queueItemId: delivery.queueItemId,
      }))}
    />
  );
}
