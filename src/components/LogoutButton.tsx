"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUI } from "@/lib/ui-language";

export default function LogoutButton() {
  const router = useRouter();
  const { t } = useUI();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      try {
        for (const key of Object.keys(sessionStorage))
          if (
            key.startsWith("ileraher-log-draft:") ||
            key.startsWith("ileraher-calendar-view")
          )
            sessionStorage.removeItem(key);
      } catch {}
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      className="logoutButton"
      type="button"
      onClick={logout}
      disabled={busy}
    >
      {busy ? t("loading") : t("signOut")}
    </button>
  );
}
