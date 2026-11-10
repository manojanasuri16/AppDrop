"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "./AppIcon";
import { ShareButton } from "./ShareButton";
import { GetButton } from "./GetButton";

type Props = {
  targetId: string;
  name: string;
  kind: "android" | "web";
  iconUrl: string | null;
  accentColor: string;
  href: string;
  disabled?: boolean;
  shareUrl: string;
  shareText: string;
  qrSvg?: string;
};

/** Compact bar that covers the shell nav once the app header scrolls out of view. */
export function StickyAppBar({ targetId, name, kind, iconUrl, accentColor, href, disabled, shareUrl, shareText, qrSvg }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  return (
    <div
      inert={!show}
      aria-hidden={!show}
      className={`material hairline-b safe-top fixed inset-x-0 top-0 z-40 transition-transform duration-500 ease-[var(--ease-spring)] ${show ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div className="mx-auto flex h-12 max-w-[1080px] items-center gap-3 px-5">
        <AppIcon name={name} iconUrl={iconUrl} accentColor={accentColor} size={30} />
        <p className="min-w-0 flex-1 truncate text-headline text-label">{name}</p>
        <ShareButton url={shareUrl} title={name} text={shareText} variant="icon" label={`Share ${name}`} qrSvg={qrSvg} className="-mr-1.5" />
        <GetButton app={{ kind, name }} href={href} disabled={disabled} />
      </div>
    </div>
  );
}
