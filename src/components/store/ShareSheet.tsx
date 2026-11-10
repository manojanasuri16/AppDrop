"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { withVia } from "./share-url";

type Props = { url: string; title: string; text?: string; qrSvg?: string; onClose: () => void };

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ShareSheet({ url, title, text, qrSvg, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
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
      clearTimeout(timer.current);
      prevFocus?.focus?.();
    };
  }, [onClose]);

  const shareUrl = withVia(url, "share");
  const msg = text ? `${text} ${shareUrl}` : `${title} ${shareUrl}`;
  const targets = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(msg)}`, bg: "#25d366", icon: <WhatsApp /> },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text ?? title)}`, bg: "#2aabee", icon: <Telegram /> },
    { name: "Email", href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(msg)}`, bg: "#0a84ff", icon: <Mail /> },
  ];

  const copy = async () => {
    if (await copyText(shareUrl)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-6">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${title}`}
        className="animate-sheet material relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),1.25rem)] max-w-md rounded-t-[28px] p-5 shadow-float ring-1 ring-black/5 dark:ring-white/10 md:rounded-[28px]"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-separator md:hidden" aria-hidden />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-title-3 text-label">{title}</h2>
            <p className="mt-0.5 truncate text-footnote text-label-3">{url}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="pressable -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label-2 hover:bg-fill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <button type="button" onClick={copy} className="btn-secondary mt-4 w-full" aria-live="polite">
          {copied ? (
            <>Copied <span aria-hidden>✓</span></>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
              </svg>
              Copy link
            </>
          )}
        </button>

        <ul className="mt-5 flex justify-center gap-7">
          {targets.map((t) => (
            <li key={t.name}>
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="pressable flex w-16 flex-col items-center gap-1.5 rounded-xl">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white" style={{ background: t.bg }}>{t.icon}</span>
                <span className="text-caption text-label-2">{t.name}</span>
              </a>
            </li>
          ))}
        </ul>

        {qrSvg && (
          <div className="mt-5 flex flex-col items-center gap-2">
            {/* SVG generated server-side by us from our own URL — safe to inject. */}
            <div className="h-36 w-36 rounded-2xl bg-white p-3 shadow-card [&>svg]:h-full [&>svg]:w-full" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="text-caption text-label-3">Scan to open</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function WhatsApp() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm0 1.8a7.2 7.2 0 1 1-3.7 13.4l-.3-.2-2.4.6.7-2.3-.2-.3A7.2 7.2 0 0 1 12 4.8zM9 8.2c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.8 2.2.8 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.2-1.6-.8c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.7-.7-1.2-1.500-1.400-1.800-.1-.2 0-.4.100-.5l.4-.4.2-.4v-.4l-.8-1.800c-.2-.5-.4-.4-.5-.4z" />
    </svg>
  );
}
function Telegram() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.7 4.3 3.4 11c-.9.4-.9 1 0 1.200l4.400 1.400 1.700 5.100c.2.600.4.800.9.800.4 0 .6-.2.900-.4l2.200-2.100 4.400 3.300c.8.500 1.400.2 1.600-.8l2.900-13.700c.3-1.200-.5-1.800-1.700-1.500zM9 13.300l9-5.600c.4-.3.800-.1.500.2l-7.400 6.700-.3 3.200L9 13.300z" />
    </svg>
  );
}
function Mail() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M4.5 8l7.500 5.500L19.500 8" />
    </svg>
  );
}
