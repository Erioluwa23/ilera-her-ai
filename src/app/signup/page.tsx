import AuthForm from "@/components/AuthForm";
import { safeReturn } from "@/lib/return-route";
export const metadata = { title: "Create account · ÌleraHer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthForm mode="signup" next={safeReturn((await searchParams).next)} />
  );
}
