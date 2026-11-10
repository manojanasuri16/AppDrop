import Link from "next/link";
import { links, type AppCard } from "@/lib/queries";
import { AppIcon } from "./AppIcon";
import { GetButton } from "./GetButton";

/** Compact shelf tile: icon, name, category, GET. */
export function AppTile({ app }: { app: AppCard }) {
  return (
    <div className="flex w-[7.5rem] shrink-0 snap-start flex-col sm:w-32">
      <Link href={links.app(app.slug)} className="pressable block rounded-[24px]" aria-label={app.name}>
        <AppIcon name={app.name} iconUrl={app.iconUrl} accentColor={app.accentColor} size={120} className="!h-auto !w-full aspect-square shadow-card" />
      </Link>
      <Link href={links.app(app.slug)} className="mt-2.5 block rounded-md">
        <p className="truncate text-subhead font-semibold text-label">{app.name}</p>
        <p className="truncate text-caption text-label-2">{app.category}</p>
      </Link>
      <div className="mt-2">
        <GetButton app={app} href={links.get(app.slug)} />
      </div>
    </div>
  );
}
