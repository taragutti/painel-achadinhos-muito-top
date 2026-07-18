import { requireAuthenticatedAdmin } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAuthenticatedAdmin();
  return <AppShell adminName={admin.name}>{children}</AppShell>;
}
