import { ChannelManager } from "@/components/channels/ChannelManager";
import { listChannels } from "@/lib/channels/application";

export default async function ChannelsPage() {
  const channels = await listChannels();
  return <ChannelManager channels={channels.map(({ id, name, platform, isActive }) => ({ id, name, platform, isActive }))} />;
}
