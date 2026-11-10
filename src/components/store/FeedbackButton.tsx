"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  slug: string;
  appName: string;
  /** Release tags, newest first. Empty for web apps (version field is hidden). */
  versions?: string[];
  label?: string;
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]),select:not([disabled])';

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5V17H5A1.5 1.5 0 0 1 3.5 15.500V7A1.5 1.5 0 0 1 5 5.500z" />
    </svg>
  );
}

/** "Send Feedback" row for the Information list. Opens a sheet; also opens on load for /apps/<slug>#feedback. */
export function FeedbackButton({ slug, appName, versions = [], label = "Send Feedback" }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const check = () => { if (window.location.hash === "#feedback") setOpen(true); };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  const dismiss = useCallback(() => {
    close();
    if (window.location.hash === "#feedback") history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [close]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-fill">
        <span className="text-body text-tint">{label}</span>
        <span className="text-tint"><ChatIcon /></span>
      </button>
      {open && <FeedbackSheet slug={slug} appName={appName} versions={versions} onClose={dismiss} />}
    </>
  );
}

function FeedbackSheet({ slug, appName, versions, onClose }: { slug: string; appName: string; versions: string[]; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const uid = useId();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("textarea")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (els.length === 0) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const message = str("message");
    if (message.length < 3) { setErrors({ message: "Please write at least 3 characters." }); return; }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/public/apps/${encodeURIComponent(slug)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, name: str("name"), contact: str("contact"), version: str("version"), website: String(f.get("website") ?? "") }),
      });
      if (res.ok) { setDone(true); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (res.status === 422 && j.fields) { setErrors(j.fields); setFormError(null); }
      else if (res.status === 429) setFormError("You've sent a few messages already. Please try again in a few minutes.");
      else setFormError(j.error ?? "Couldn't send your feedback. Please try again.");
    } catch {
      setFormError("Couldn't reach AppDrop. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const err = (k: string) => errors[k];
  const errId = (k: string) => `${uid}-${k}-err`;
  const aria = (k: string) => (err(k) ? { "aria-invalid": true as const, "aria-describedby": errId(k) } : {});
  const FieldError = ({ k }: { k: string }) => (err(k) ? <p id={errId(k)} className="mt-1 text-footnote text-danger">{err(k)}</p> : null);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-6">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="animate-sheet material relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-float ring-1 ring-black/5 dark:ring-white/10 md:rounded-[28px]"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-separator md:hidden" aria-hidden />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-title`} className="text-title-3 text-label">Send Feedback</h2>
            <p className="mt-0.5 truncate text-footnote text-label-3">About {appName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="pressable -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label-2 hover:bg-fill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {done ? (
          <div className="animate-rise flex flex-col items-center py-8 text-center" role="status">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.500" /></svg>
            </span>
            <p className="mt-4 text-headline text-label">Thanks! Your feedback was sent.</p>
            <button type="button" onClick={onClose} className="btn-secondary mt-6 w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-4">
            <div>
              <label htmlFor={`${uid}-message`} className="mb-1.5 block text-subhead font-medium text-label">Message</label>
              <textarea id={`${uid}-message`} name="message" required rows={5} maxLength={4000} placeholder="What's working, what isn't, what you'd love to see…" className="field" {...aria("message")} />
              <FieldError k="message" />
            </div>
            <div>
              <label htmlFor={`${uid}-name`} className="mb-1.5 block text-subhead font-medium text-label">Name <span className="font-normal text-label-3">(optional)</span></label>
              <input id={`${uid}-name`} name="name" type="text" autoComplete="name" maxLength={80} className="field" {...aria("name")} />
              <FieldError k="name" />
            </div>
            <div>
              <label htmlFor={`${uid}-contact`} className="mb-1.5 block text-subhead font-medium text-label">How can Manoj reach you? <span className="font-normal text-label-3">(optional)</span></label>
              <input id={`${uid}-contact`} name="contact" type="text" autoComplete="off" maxLength={200} placeholder="Email or phone" className="field" {...aria("contact")} />
              <FieldError k="contact" />
            </div>
            {versions.length > 0 && (
              <div>
                <label htmlFor={`${uid}-version`} className="mb-1.5 block text-subhead font-medium text-label">Installed version <span className="font-normal text-label-3">(optional)</span></label>
                <input id={`${uid}-version`} name="version" type="text" list={`${uid}-versions`} defaultValue={versions[0]} maxLength={40} autoComplete="off" className="field" {...aria("version")} />
                <datalist id={`${uid}-versions`}>{versions.map((v) => <option key={v} value={v} />)}</datalist>
                <FieldError k="version" />
              </div>
            )}
            {/* Honeypot: invisible to people and assistive tech, bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>

            {formError && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-subhead text-danger">{formError}</p>}
            <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary w-full">
              {pending ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
