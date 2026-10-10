import AppShell from "@/components/AppShell";
import FeedbackForm from "@/components/FeedbackForm";
export const metadata = { title: "Feedback · ÌleraHer" };
export default function Page() {
  return (
    <AppShell>
      <FeedbackForm />
    </AppShell>
  );
}
