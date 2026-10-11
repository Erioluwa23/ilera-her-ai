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
      <p>{t("phoneDialHint")}</p>
      <span className="ux-badge">{t("phoneDedicatedNumber")}</span>
      <p>
        <strong dir="ltr">{PHONE_SUPPORT_DISPLAY}</strong>
      </p>
      <p className="ux-phone-actions">
        <a
          className="ux-btn"
          href={"tel:" + PHONE_SUPPORT_NUMBER}
          aria-label={t("phoneCall") + ": " + PHONE_SUPPORT_DISPLAY}
        >
          <Icon name="phone" />
          {t("phoneCall")}
        </a>
        <Link className="ux-btn ux-secondary" href="/settings/phone">
          <Icon name="lock" />
          {t("phoneSetup")}
        </Link>
      </p>
      <details>
        <summary>{t("more")}</summary>
        <p>
          {t("healthInfo")}. {t("callCharges")}
        </p>
      </details>
    </article>
  );
}
