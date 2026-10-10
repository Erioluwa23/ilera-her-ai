import AppShell from "@/components/AppShell";
import LatePeriodScreen from "@/components/LatePeriodScreen";
export const metadata = { title: "Delayed-period help · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <AppShell>
      <LatePeriodScreen recordId={id} />
    </AppShell>
  );
}
