"use client";
import { useEffect, useId, useRef, useState } from "react";
import { SpinnerIcon } from "./icons";

export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", requireText, onConfirm, onCancel, pending,
}: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel?: string;
  requireText?: string; onConfirm: () => void; onCancel: () => void; pending?: boolean;
}) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setTyped("");
    const t = setTimeout(() => ref.current?.focus(), 50);
    const k = (e: KeyboardEvent) => e.key === "Escape" && !pending && onCancel();
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
  }, [open, pending, onCancel]);
  if (!open) return null;
  const ok = !requireText || typed.trim() === requireText;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={() => !pending && onCancel()} aria-hidden />
      <div
        role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}
        className="animate-sheet relative w-full max-w-md rounded-t-3xl bg-elevated p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-3xl"
      >
        <h2 id={`${id}-t`} className="text-title-3">{title}</h2>
        <div id={`${id}-d`} className="text-subhead mt-2 text-label-2">{message}</div>
        {requireText && (
          <input
            ref={ref} className="field mt-4" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder={requireText} aria-label={`Type ${requireText} to confirm`} autoComplete="off" autoCapitalize="off" spellCheck={false}
          />
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>Cancel</button>
          <button
            type="button" disabled={!ok || pending} onClick={onConfirm}
            className="btn-secondary !bg-danger !text-white disabled:opacity-40"
          >
            {pending && <SpinnerIcon width={18} height={18} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
