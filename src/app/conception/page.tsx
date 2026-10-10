import AppShell from "@/components/AppShell";
import ConceptionScreen from "@/components/ConceptionScreen";
export const metadata = { title: "Trying to conceive · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <AppShell>
      <ConceptionScreen recordId={(await searchParams).id} />
    </AppShell>
  );
}
