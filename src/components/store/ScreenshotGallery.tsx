"use client";

import { useState } from "react";
import { Lightbox, type Shot } from "./Lightbox";

export function ScreenshotGallery({ shots, name }: { shots: Shot[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!shots.length) return null;
  return (
    <>
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1">
        {shots.map((s, i) => {
          const ratio = s.width && s.height ? s.width / s.height : 9 / 19.5;
          return (
            <button
              key={s.url}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`View ${name} screenshot ${i + 1} full screen`}
              className="pressable h-[24rem] shrink-0 snap-start overflow-hidden rounded-[18px] bg-secondary ring-1 ring-black/5 dark:ring-white/10 sm:h-[28rem]"
              style={{ aspectRatio: String(ratio) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.url}
                alt={`${name} screenshot ${i + 1}`}
                width={s.width ?? 540}
                height={s.height ?? 1170}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          );
        })}
      </div>
      {open !== null && <Lightbox shots={shots} index={open} name={name} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </>
  );
}
