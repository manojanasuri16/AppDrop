"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/apps") },
  { href: "/search", label: "Search", match: (p: string) => p.startsWith("/search") },
] as const;

function Icon({ name, active }: { name: "Today" | "Search"; active: boolean }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: active && name === "Today" ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  return name === "Today" ? (
    <svg {...common}><rect x="4" y="4" width="16" height="16" rx="4.5" /><path d="M8.5 12h7M8.5 8.5h4" stroke={active ? "var(--bg)" : "currentColor"} /></svg>
  ) : (
    <svg {...common} strokeWidth={active ? 2.25 : 1.75}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
  );
}

export function TopLinks() {
  const p = usePathname();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {ITEMS.map((i) => {
        const on = i.match(p);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 text-subhead font-medium transition-colors ${on ? "bg-fill text-label" : "text-label-2 hover:text-label"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const p = usePathname();
  return (
    <nav aria-label="Tabs" className="material hairline-t safe-bottom fixed inset-x-0 bottom-0 z-30 md:hidden">
      <ul className="mx-auto grid h-[3.25rem] max-w-sm grid-cols-2">
        {ITEMS.map((i) => {
          const on = i.match(p);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`pressable flex h-full flex-col items-center justify-center gap-0.5 ${on ? "text-tint" : "text-label-2"}`}>
                <Icon name={i.label} active={on} />
                <span className="text-[0.625rem] font-medium leading-none">{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
