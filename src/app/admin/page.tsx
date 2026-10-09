import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminDashboard from "@/components/AdminDashboard";
import { isAdminSession } from "@/lib/admin";
import { sessionCookie, verifySessionToken } from "@/lib/session";

export const metadata = { title: "Admin dashboard · ÌleraHer AI" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(sessionCookie.name)?.value);

  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  return (
    <AppShell>
      <section className="panel adminPanel">
        <span className="eyebrow">Admin reporting</span>
        <h1>ÌleraHer product dashboard</h1>
        <p className="muted">
          Monitor adoption and user feedback without displaying menstrual or health histories.
        </p>
        <AdminDashboard />
      </section>
    </AppShell>
  );
}
