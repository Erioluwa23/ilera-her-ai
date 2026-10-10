import AppShell from "@/components/AppShell";
import GrowthScreen from "@/components/GrowthScreen";
export const metadata = { title: "Growth records · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <AppShell>
      <GrowthScreen recordId={(await searchParams).id} />
    </AppShell>
  );
}
