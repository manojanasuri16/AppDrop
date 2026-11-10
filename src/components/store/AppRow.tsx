import Link from "next/link";
import { links, type AppCard } from "@/lib/queries";
import { AppIcon } from "./AppIcon";
import { GetButton } from "./GetButton";

export function AppRow({ app, index = 0 }: { app: AppCard; index?: number }) {
  return (
    <li
      className="animate-rise group/row flex items-center gap-3.5 pl-0 [&:last-child_.row-body]:border-b-0"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <Link href={links.app(app.slug)} className="pressable shrink-0 py-2.5" aria-label={app.name} tabIndex={-1}>
        <AppIcon name={app.name} iconUrl={app.iconUrl} accentColor={app.accentColor} size={64} />
      </Link>
      <div className="row-body flex min-w-0 flex-1 items-center gap-3 self-stretch border-b-[0.5px] border-separator py-2.5">
        <Link href={links.app(app.slug)} className="min-w-0 flex-1 rounded-md">
          <p className="truncate text-headline text-label">{app.name}</p>
          <p className="truncate text-footnote text-label-2">{app.tagline || app.category}</p>
          <p className="truncate text-caption text-label-3">
            {app.tagline ? app.category : app.kind === "web" ? "Web app" : "Android"}
          </p>
        </Link>
        <GetButton app={app} href={links.get(app.slug)} />
      </div>
    </li>
  );
}
