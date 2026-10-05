import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import LogScreen from "@/components/LogScreen";
export default function LogPage() {
  return (
    <AppShell>
      <Suspense fallback={<p role="status">Opening your period log…</p>}>
        <LogScreen />
      </Suspense>
    </AppShell>
  );
}
