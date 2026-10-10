"use client";
import { useState } from "react";
import Link from "next/link";
import { useUI } from "@/lib/ui-language";
import Icon from "./Icon";
import Dialog from "./Dialog";
import PhoneSupport from "./PhoneSupport";
export default function SupportList() {
  const { t } = useUI(),
    [care, setCare] = useState(false);
  return (
    <section className="ux-help">
      <div className="ux-page-heading">
        <h1>{t("hereForYou")}</h1>
      </div>
      <p className="ux-muted ux-subtitle">{t("chooseNeed")}</p>
      <div className="ux-support-list">
        <Link href="/lite">
          <span className="ux-icon-circle">
            <Icon name="wifi" />
          </span>
          <span>
            <strong>{t("lowData")}</strong>
            <small>{t("lowDataHint")}</small>
          </span>
          <Icon name="arrow" />
        </Link>
        <button onClick={() => setCare(true)}>
          <span className="ux-icon-circle">
            <Icon name="heart" />
          </span>
          <span>
            <strong>{t("care")}</strong>
            <small>{t("careHint")}</small>
          </span>
          <Icon name="arrow" />
        </button>
        <Link href="/settings/privacy">
          <span className="ux-icon-circle">
            <Icon name="lock" />
          </span>
          <span>
            <strong>{t("privacyLanguage")}</strong>
            <small>{t("yourChoices")}</small>
          </span>
          <Icon name="arrow" />
        </Link>
        <Link href="/feedback">
          <span className="ux-icon-circle">
            <Icon name="smile" />
          </span>
          <span>
            <strong>{t("feedback")}</strong>
            <small>{t("feedbackHint")}</small>
          </span>
          <Icon name="arrow" />
        </Link>
      </div>
      <PhoneSupport />
      <div className="ux-info-box">
        <Icon name="info" />
        <p>{t("healthInfo")}</p>
      </div>
      {care && (
        <Dialog title={t("care")} onClose={() => setCare(false)}>
          <span className="ux-icon-circle">
            <Icon name="heart" size={32} />
          </span>
          <p>{t("moreCare")}</p>
          <Link className="ux-btn ux-secondary" href="/voice">
            <Icon name="mic" />
            {t("ask")}
          </Link>
        </Dialog>
      )}
    </section>
  );
}
