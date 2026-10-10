import AppShell from "@/components/AppShell";
import PregnancyScreen from "@/components/PregnancyScreen";
export const metadata = { title: "Pregnancy records · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <AppShell>
      <PregnancyScreen recordId={(await searchParams).id} />
    </AppShell>
  );
}
