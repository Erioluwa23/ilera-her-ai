import AppShell from "@/components/AppShell";
import FertilityScreen from "@/components/FertilityScreen";
export const metadata = { title: "Fertility information · ÌleraHer" };
export default function Page() {
  return (
    <AppShell>
      <FertilityScreen />
    </AppShell>
  );
}
