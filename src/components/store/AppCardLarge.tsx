import Link from "next/link";
import { links, type AppCard } from "@/lib/queries";
import { AppIcon } from "./AppIcon";
import { DownloadLine } from "./DownloadLine";
import { GetButton } from "./GetButton";

export function AppCardLarge({ app, index = 0, className = "" }: { app: AppCard; index?: number; className?: string }) {
  const c = app.accentColor || "#0a84ff";
  return (
    <article
      className={`animate-rise pressable relative isolate flex min-h-[15rem] flex-col justify-between overflow-hidden rounded-[24px] bg-elevated p-6 shadow-card ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      style={{
        animationDelay: `${index * 80}ms`,
        backgroundImage: `linear-gradient(155deg, color-mix(in srgb, ${c} 22%, transparent), color-mix(in srgb, ${c} 4%, transparent) 70%)`,
      }}
    >
      <Link href={links.app(app.slug)} aria-label={`${app.name}, ${app.tagline}`} className="absolute inset-0 z-0 rounded-[24px]" />
      <div className="pointer-events-none relative z-10">
        <p className="text-eyebrow" style={{ color: `color-mix(in srgb, ${c} 80%, var(--label))` }}>
          Featured
        </p>
        <h3 className="mt-2 text-title-1 text-label">{app.name}</h3>
        <p className="mt-1 line-clamp-2 max-w-[28ch] text-callout text-label-2">{app.tagline || app.category}</p>
      </div>
      <div className="relative z-10 mt-8 flex items-center gap-3.5 rounded-2xl bg-bg/60 p-2.5 pr-3.5 backdrop-blur-xl">
        <AppIcon name={app.name} iconUrl={app.iconUrl} accentColor={app.accentColor} size={52} />
        <div className="pointer-events-none min-w-0 flex-1">
          <p className="truncate text-subhead font-semibold text-label">{app.name}</p>
          <DownloadLine href={links.get(app.slug)} enabled={app.kind !== "web"}>
            <p className="truncate text-caption text-label-2">{app.category}</p>
          </DownloadLine>
        </div>
        <GetButton app={app} href={links.get(app.slug)} />
      </div>
    </article>
  );
}
