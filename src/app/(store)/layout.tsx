import Link from "next/link";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ShareButton } from "@/components/store/ShareButton";
import { STORE_SHARE_TEXT } from "@/components/store/ShareStoreCard";
import { getSiteOrigin, qrSvg } from "@/components/store/share-server";
import { TabBar, TopLinks } from "@/components/store/StoreNav";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const origin = await getSiteOrigin();
  const qr = await qrSvg(origin);
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="material hairline-b safe-top sticky top-0 z-30">
        <div className="mx-auto flex h-12 max-w-[1080px] items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-8">
            <Link href="/" className="pressable flex items-center gap-2 rounded-lg" aria-label="AppDrop home">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-gradient-to-br from-[#5ac8fa] via-[#0a84ff] to-[#5e5ce6] shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 4v10M7.5 10l4.5 4.5 4.5-4.5M6 19h12" />
                </svg>
              </span>
              <span className="text-headline font-bold tracking-tight text-label">AppDrop</span>
            </Link>
            <TopLinks />
          </div>
          <div className="-mr-2 flex items-center gap-1">
            <InstallButton />
            <ShareButton url={origin} title="AppDrop" text={STORE_SHARE_TEXT} variant="icon" label="Share AppDrop" qrSvg={qr} className="text-label-2! hover:text-label!" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 overflow-x-clip px-5 pb-28 md:pb-16">{children}</main>

      <footer className="mx-auto w-full max-w-[1080px] px-5 pb-28 pt-6 text-center md:pb-10">
        <p className="text-caption text-label-3">Made with care. Apps are distributed directly from GitHub Releases.</p>
      </footer>

      <TabBar />
    </div>
  );
}
