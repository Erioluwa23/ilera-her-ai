"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import Icon from "./Icon";
import { useUI } from "@/lib/ui-language";
export default function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId(),
    { t } = useUI();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="ux-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="ux-dialog-body">
        <header>
          <h2 id={id}>{title}</h2>
          <button
            className="ux-icon-button"
            aria-label={t("close")}
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
