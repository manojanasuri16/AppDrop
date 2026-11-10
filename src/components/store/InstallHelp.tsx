"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STEPS = [
  ["Tap Get", "Your browser downloads the APK file."],
  ["Open the downloaded file", "Find it in your notification shade or Downloads folder."],
  ["Allow “Install unknown apps”", "When asked, enable it for your browser. You only do this once."],
  ["Updating later", "Install the newer APK over the old one. The same signing key keeps your data."],
];

export function InstallHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const ov = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const f = ref.current?.querySelectorAll<HTMLElement>("button");
        if (!f?.length) return;
        e.preventDefault();
        f[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = ov;
      prev?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="pressable flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-tint text-white">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" /></svg>
        </span>
        <span className="flex-1 text-body text-label">How to install</span>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--label-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 1l6 6-6 6" /></svg>
      </button>
      {open &&
        createPortal(
          <div className="animate-fade fixed inset-0 z-[100] flex items-end justify-center bg-black/40 md:items-center" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="install-title" className="animate-sheet safe-bottom w-full max-w-lg rounded-t-[28px] bg-elevated p-6 shadow-float md:rounded-[28px]">
              <div className="mb-1 flex items-start justify-between gap-4">
                <h2 id="install-title" className="text-title-2 text-label">How to install</h2>
                <button type="button" onClick={() => setOpen(false)} className="pressable -mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-label-2 hover:bg-fill" aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <p className="text-subhead text-label-2">Android apps are installed straight from an APK file.</p>
              <ol className="mt-5 space-y-4 pb-3">
                {STEPS.map(([t, d], i) => (
                  <li key={t} className="flex gap-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-bold text-tint">{i + 1}</span>
                    <div>
                      <p className="text-callout font-semibold text-label">{t}</p>
                      <p className="text-subhead text-label-2">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
