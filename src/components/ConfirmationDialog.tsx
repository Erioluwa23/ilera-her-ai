"use client";
import { useEffect, useId, useRef } from "react";
import { useLanguage } from "@/lib/use-language";
import { copy } from "@/lib/ui-copy";
export default function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId(),
    { language } = useLanguage();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirmDialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
      <div className="screenActions">
        <button
          className="secondaryBtn"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          {copy(language, "keep")}
        </button>
        <button className="btn destructive" disabled={busy} onClick={onConfirm}>
          {busy ? copy(language, "saving") : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
