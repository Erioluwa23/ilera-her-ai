import AppShell from "@/components/AppShell";
import BabyScreen from "@/components/BabyScreen";
export const metadata = { title: "Baby records · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <AppShell>
      <BabyScreen recordId={(await searchParams).id} />
    </AppShell>
  );
}
