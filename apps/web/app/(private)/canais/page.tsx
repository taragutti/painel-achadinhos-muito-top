import { SectionPage } from "@/components/ui/SectionPage";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";
export default async function ChannelsPage() { await requireAuthenticatedAdmin(); return <SectionPage title="Canais" description="Gerencie os destinos de WhatsApp e Telegram." icon="◎" emptyTitle="Nenhum canal conectado" emptyDescription="As conexões externas continuam desativadas nesta fase." />; }
