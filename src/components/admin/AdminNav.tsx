"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";

const ITEMS = [
  { href: "/admin", label: "Apps", match: (p: string) => p === "/admin" || p.startsWith("/admin/apps") },
  { href: "/admin/feedback", label: "Feedback", badge: true, match: (p: string) => p.startsWith("/admin/feedback") },
  { href: "/admin/beta", label: "Beta", match: (p: string) => p.startsWith("/admin/beta") },
  { href: "/admin/notifications", label: "Notifications", match: (p: string) => p.startsWith("/admin/notifications") },
];

export function AdminNav({ unread }: { unread: number }) {
  const path = usePathname() ?? "";
  const pill = "pressable text-subhead relative flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium";
  return (
    <nav aria-label="Admin">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((i) => {
          const on = i.match(path);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`${pill} ${on ? "bg-fill text-label" : "text-label-2 hover:bg-fill"}`}>
              {i.label}
              {i.badge && unread > 0 && (
                <span className="text-caption min-w-5 rounded-full bg-danger px-1.5 text-center font-bold leading-5 text-white tabular-nums" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>
              )}
            </Link>
          );
        })}
        <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
          <Link href="/admin/apps/new" className={`${pill} text-tint hover:bg-fill`}>New app</Link>
          <Link href="/" className={`${pill} hidden text-tint hover:bg-fill sm:flex`}>Store</Link>
          <form action={logout}><button type="submit" className={`${pill} hidden text-tint hover:bg-fill sm:flex`}>Sign out</button></form>
        </span>
      </div>
    </nav>
  );
}
