"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement("textarea");
      t.value = value;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch {}
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? "Copied" : label}
      className="pressable flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-fill px-3 text-footnote font-semibold text-tint hover:bg-fill-strong"
    >
      <span aria-live="polite">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}
