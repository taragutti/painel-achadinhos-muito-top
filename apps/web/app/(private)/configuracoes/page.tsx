import { SettingsForm } from "@/components/settings/SettingsForm";
import { getOperationalSettings } from "@/lib/operations/application";
import { requireAuthenticatedAdmin } from "@/lib/auth/session";
export default async function SettingsPage() {
  await requireAuthenticatedAdmin();
  const data = await getOperationalSettings();
  return (
    <SettingsForm
      initialSettings={data.settings}
      channels={data.channels}
      templates={data.templates}
    />
  );
}
