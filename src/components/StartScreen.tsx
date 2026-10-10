"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/lib/experience";
export default function StartScreen() {
  const { prefs } = usePreferences(),
    router = useRouter();
  useEffect(() => {
    router.replace(
      prefs.onboardingVersionCompleted >= 1 ? "/home" : "/onboarding",
    );
  }, [prefs.onboardingVersionCompleted, router]);
  return <p role="status">Opening ÌleraHer…</p>;
}
