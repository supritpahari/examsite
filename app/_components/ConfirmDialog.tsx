/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app
 * Shared custom confirm dialog — replaces window.confirm everywhere.
 * role="alertdialog", Esc / overlay-click cancels, Enter confirms,
 * danger variant for irreversible actions (red confirm). */
"use client";

import { useEffect, useRef } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Irreversible/destructive action — red confirm button, danger icon. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener("keydown", onKey);
    // Safe default: autofocus the low-risk action for destructive flows.
    (danger ? cancelRef : confirmRef).current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, danger, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={onCancel}
    >
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-ico${danger ? " danger" : ""}`} aria-hidden="true">
          {danger ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v5" />
              <path d="M12 16.5h.01" />
              <path d="M10.3 3.9L2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6" />
              <path d="M12 7.5h.01" />
            </svg>
          )}
        </div>
        <h2 className="confirm-title" id="confirm-dialog-title">{title}</h2>
        <p className="confirm-desc" id="confirm-dialog-desc">{description}</p>
        <div className="confirm-foot">
          <button ref={cancelRef} type="button" className="btn btn--soft" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? "btn btn--danger-fill" : "btn"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
