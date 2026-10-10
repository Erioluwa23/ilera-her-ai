import AppShell from "@/components/AppShell";
import FeedbackForm from "@/components/FeedbackForm";
import EnglishContent from "@/components/EnglishContent";

export const metadata = { title: "Feedback · ÌleraHer AI" };

export default function FeedbackPage() {
  return (
    <AppShell>
      <section className="panel">
        <EnglishContent>
          <span className="eyebrow">Help us improve</span>
          <h1>Tell us about your experience.</h1>
          <p className="muted">
            Report a problem, suggest an improvement, or tell us what worked
            well.
          </p>
          <FeedbackForm />
        </EnglishContent>
      </section>
    </AppShell>
  );
}
