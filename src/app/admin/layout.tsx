import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { LogoGlyph } from "@/components/admin/icons";
import { AdminNav } from "@/components/admin/AdminNav";
import { storeStats } from "@/lib/stats";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  const unread = authed ? (await storeStats(30).catch(() => null))?.unreadFeedback ?? 0 : 0;
  return (
    <div className="min-h-dvh bg-grouped">
      <header className="material hairline-b sticky top-0 z-40 safe-top">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={authed ? "/admin" : "/admin/login"} className="pressable flex items-center gap-2.5" aria-label="AppDrop Admin home">
            <LogoGlyph size={26} />
            <span className="text-headline">AppDrop <span className="text-label-2 font-medium">Admin</span></span>
          </Link>
          <ThemeToggle />
        </div>
        {authed && <AdminNav unread={unread} />}
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:pt-10">{children}</main>
    </div>
  );
}
