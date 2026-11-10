"use client";
import { useEffect, useId, useState } from "react";
import { ImageIcon } from "./icons";

export function ImageInput({
  name, label, currentUrl, error, accent = "#0a84ff", round = true,
}: { name: string; label: string; currentUrl?: string | null; error?: string; accent?: string; round?: boolean }) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const src = preview ?? currentUrl ?? null;
  return (
    <div className="flex items-center gap-4">
      <div
        className={`grid size-20 shrink-0 place-items-center overflow-hidden ${round ? "squircle" : "rounded-2xl"} text-white`}
        style={{ background: src ? "var(--fill)" : `linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 60%, #000))`, boxShadow: "inset 0 0 0 0.5px var(--separator)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" className="size-full object-cover" /> : <ImageIcon width={28} height={28} />}
      </div>
      <div className="min-w-0">
        <label htmlFor={id} className="btn-secondary cursor-pointer !h-10 text-subhead">
          {src ? "Replace icon" : "Choose icon"}
        </label>
        <input
          id={id} name={name} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={label}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        <p className="text-footnote mt-1.5 text-label-2">Square PNG, JPEG or WebP, up to 4 MB.</p>
        {error && <p role="alert" className="text-footnote text-danger">{error}</p>}
      </div>
    </div>
  );
}
