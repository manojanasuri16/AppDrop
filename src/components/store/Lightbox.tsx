"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type Shot = { url: string; width: number | null; height: number | null };

export function Lightbox({ shots, index, name, onClose, onIndex }: { shots: Shot[]; index: number; name: string; onClose: () => void; onIndex: (i: number) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const last = shots.length - 1;

  const go = useCallback((d: number) => onIndex(Math.min(last, Math.max(0, index + d))), [index, last, onIndex]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        const f = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f || !f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
        else if (!dialogRef.current?.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const shot = shots[index];
  const arrow = "pressable absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 disabled:opacity-30 md:flex";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} screenshots`}
      className="animate-fade fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <button type="button" onClick={onClose} aria-label="Close" className="pressable absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous screenshot" className={`${arrow} left-5`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button type="button" onClick={() => go(1)} disabled={index === last} aria-label="Next screenshot" className={`${arrow} right-5`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={shot.url}
        src={shot.url}
        alt={`${name} screenshot ${index + 1} of ${shots.length}`}
        width={shot.width ?? 1080}
        height={shot.height ?? 2340}
        decoding="async"
        className="animate-rise max-h-[84dvh] w-auto max-w-[92vw] rounded-[22px] object-contain shadow-float"
      />
      <p className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 text-center text-footnote text-white/70" aria-live="polite">
        {index + 1} / {shots.length}
      </p>
    </div>,
    document.body,
  );
}
