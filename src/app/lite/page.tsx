import AppShell from "@/components/AppShell";
import VoiceLog from "@/components/VoiceLog";
export const metadata = {
  title: "ÌleraHer Lite",
  description: "Low-bandwidth menstrual health assistant",
};
export default function Page() {
  return (
    <AppShell>
      <VoiceLog compact />
    </AppShell>
  );
}
