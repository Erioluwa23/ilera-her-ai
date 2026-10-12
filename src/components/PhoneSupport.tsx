"use client";
import { useUI } from "@/lib/ui-language";
import {
  PHONE_SUPPORT_NUMBER,
  PHONE_SUPPORT_DISPLAY,
} from "@/lib/phone-contact";
import Icon from "./Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
export default function PhoneSupport() {
  const { t } = useUI();
  const [telephoneNumber, setTelephoneNumber] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ivr/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const status = await response.json();
        if (status.ready === true && /^\+[1-9]\d{6,14}$/.test(status.phoneNumber || ""))
          setTelephoneNumber(status.phoneNumber);
      })
      .catch(() => { /* An unverified number is never presented as the agent. */ });
    return () => controller.abort();
  }, []);
  return (
    <article className="ux-phone-card">
      <div>
        <Icon name="phone" />
        <h2>{t("phone")}</h2>
      </div>
      <h3>{t("ordinaryCall")}</h3>
      <p>{telephoneNumber ? t("phoneDialHint") : t("ordinaryCallPending")}</p>
      {telephoneNumber && <>
        <p className="ux-phone-actions"><a className="ux-btn" href={"tel:" + telephoneNumber}>
          <Icon name="phone" />{t("ordinaryCall")} <span dir="ltr">{telephoneNumber}</span>
        </a></p>
        <p>{t("ordinaryCallCharges")}</p>
      </>}
      <h3>{t("callInApp")}</h3>
      <p>{t("callInternetHint")}</p>
      <p className="ux-phone-actions">
        <Link
          className="ux-btn"
          href="/call"
        >
          <Icon name="phone" />
          {t("phoneCall")}
        </Link>
        <Link className="ux-btn ux-secondary" href="/settings/phone">
          <Icon name="lock" />
          {t("phoneSetup")}
        </Link>
      </p>
      <details>
        <summary>{t("more")}</summary>
        <p>{t("healthInfo")}</p>
        <p>{t("callContact")}: <a href={"tel:" + PHONE_SUPPORT_NUMBER} dir="ltr">{PHONE_SUPPORT_DISPLAY}</a></p>
      </details>
    </article>
  );
}
