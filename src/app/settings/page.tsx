import AppShell from "@/components/AppShell";
import SettingsScreen from "@/components/SettingsScreen";
export const metadata = { title: "Settings · ÌleraHer" };
export default function Page() {
  return (
    <AppShell>
      <SettingsScreen />
    </AppShell>
  );
}
