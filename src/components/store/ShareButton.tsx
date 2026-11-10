"use client";

import { useState } from "react";
import { ShareSheet } from "./ShareSheet";
import { withVia } from "./share-url";

type Props = {
  /** Absolute URL, or a path resolved against window.location.origin. */
  url: string;
  title: string;
  text?: string;
  variant?: "icon" | "pill" | "row";
  label?: string;
  className?: string;
  /** Server-generated SVG QR code of the URL (shown in the fallback sheet). */
  qrSvg?: string;
};

export function ShareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5v11M8.5 7L12 3.5 15.5 7" />
      <path d="M8 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

export function ShareButton({ url, title, text, variant = "icon", label, className = "", qrSvg }: Props) {
  const [open, setOpen] = useState(false);
  const [abs, setAbs] = useState(url);

  const onClick = async () => {
    const full = new URL(url, window.location.origin).toString();
    setAbs(full);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: withVia(full, "share") });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setOpen(true);
      }
      return;
    }
    setOpen(true);
  };

  const text2 = label ?? "Share";
  const common = { type: "button" as const, onClick, "aria-haspopup": "dialog" as const };
  let btn: React.ReactNode;
  if (variant === "icon") {
    btn = (
      <button {...common} aria-label={label ?? `Share ${title}`} className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tint hover:bg-fill ${className}`}>
        <ShareIcon />
      </button>
    );
  } else if (variant === "pill") {
    btn = (
      <button {...common} className={`btn-primary ${className}`}>
        <ShareIcon size={18} />
        {text2}
      </button>
    );
  } else {
    btn = (
      <button {...common} className={`flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-fill ${className}`}>
        <span className="text-body text-tint">{text2}</span>
        <span className="text-tint"><ShareIcon /></span>
      </button>
    );
  }

  return (
    <>
      {btn}
      {open && <ShareSheet url={abs} title={title} text={text} qrSvg={qrSvg} onClose={() => setOpen(false)} />}
    </>
  );
}
