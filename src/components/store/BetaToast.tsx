"use client";

import { useEffect, useState } from "react";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  joined: { text: "You're in! You'll now see beta versions.", ok: true },
  left: { text: "You left the beta.", ok: true },
  invalid: { text: "That invite link is invalid or was revoked.", ok: false },
  error: { text: "Something went wrong with that invite link. Please try again.", ok: false },
};

/** One-time toast for /?beta=joined|left|invalid|error. Cleans the param from the URL. */
export function BetaToast({ status }: { status?: string }) {
  const msg = status ? MESSAGES[status] : undefined;
  const [show, setShow] = useState(!!msg);

  useEffect(() => {
    if (!msg) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("beta")) {
      url.searchParams.delete("beta");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-5 md:bottom-8">
      {msg && show && (
        <div className="animate-sheet material pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-float ring-1 ring-black/5 dark:ring-white/10">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${msg.ok ? "bg-success" : "bg-warning"}`} aria-hidden>
            {msg.ok ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.500l4.500 4.500L19 7.500" /></svg>
            ) : (
              <span className="text-footnote font-bold">!</span>
            )}
          </span>
          <p className="text-subhead text-label">{msg.text}</p>
          <button type="button" onClick={() => setShow(false)} aria-label="Dismiss" className="pressable -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
