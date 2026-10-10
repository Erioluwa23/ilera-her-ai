import AppShell from "@/components/AppShell";
import VoiceLog from "@/components/VoiceLog";
export const metadata = { title: "Ask · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const thread = (await searchParams).thread;
  return (
    <AppShell>
      <VoiceLog
        initialThread={
          thread && /^[a-zA-Z0-9_-]{1,120}$/.test(thread) ? thread : undefined
        }
      />
    </AppShell>
  );
}
