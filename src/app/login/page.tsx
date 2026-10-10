import AuthForm from "@/components/AuthForm";
import { safeReturn } from "@/lib/return-route";
export const metadata = { title: "Sign in · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return <AuthForm mode="login" next={safeReturn((await searchParams).next)} />;
}
