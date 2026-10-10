import AppShell from "@/components/AppShell";
import Welcome from "@/components/Welcome";
import { safeReturn } from "@/lib/return-route";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AppShell>
      <Welcome returnTo={safeReturn(params.next, "/home")} />
    </AppShell>
  );
}
