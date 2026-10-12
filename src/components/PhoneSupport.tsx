"use client";
import { useUI } from "@/lib/ui-language";
import {
  PHONE_SUPPORT_NUMBER,
  PHONE_SUPPORT_DISPLAY,
} from "@/lib/phone-contact";
import Icon from "./Icon";
import Link from "next/link";
export default function PhoneSupport() {
  const { t } = useUI();
  return (
    <article className="ux-phone-card">
      <div>
        <Icon name="phone" />
        <h2>{t("phone")}</h2>
      </div>
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
