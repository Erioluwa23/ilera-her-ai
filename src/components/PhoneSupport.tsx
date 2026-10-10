"use client";
import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui-language";
import { languageName, type IlaraLanguage } from "@/lib/languages";
import Icon from "./Icon";
import Link from "next/link";
type Status = {
  ready: boolean;
  phoneNumber: string | null;
  languages: IlaraLanguage[];
};
export default function PhoneSupport() {
  const [status, setStatus] = useState<Status | null>(null),
    { t } = useUI();
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/phone/status", { signal: c.signal, cache: "no-store" })
      .then(async (r) => {
        const sim = r.ok ? await r.json() : null;
        if (sim?.configured) return sim;
        const legacy = await fetch("/api/ivr/status", { signal: c.signal, cache: "no-store" });
        return legacy.ok ? legacy.json() : null;
      })
      .then(setStatus)
      .catch(() => {});
    return () => c.abort();
  }, []);
  return (
    <article className="ux-phone-card">
      <div>
        <Icon name="phone" />
        <h2>{t("phone")}</h2>
      </div>
      {status?.ready && status.phoneNumber ? (
        <>
          <a className="ux-btn" href={"tel:" + status.phoneNumber}>
            <Icon name="phone" />
            {status.phoneNumber}
          </a>
          <p>{status.languages.map(languageName).join(", ")}</p>
        </>
      ) : (
        <>
          <span className="ux-badge">{t("comingSoon")}</span>
          <p>{t("verifiedNumber")}</p>
        </>
      )}
      <Link className="ux-btn ux-secondary" href="/settings/phone"><Icon name="lock" />{t("phoneSetup")}</Link>
      <details>
        <summary>{t("more")}</summary>
        <p>
          {t("healthInfo")}. {t("callCharges")}
        </p>
      </details>
    </article>
  );
}
