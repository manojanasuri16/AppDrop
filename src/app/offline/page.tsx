import type { Metadata } from "next";
import { RetryButton } from "@/components/pwa/RetryButton";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="safe-top safe-bottom bg-bg flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="animate-rise flex flex-col items-center gap-6">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-[22.5%] shadow-card"
          style={{ backgroundImage: "linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)" }}
          aria-hidden="true"
        >
          <svg width="54" height="54" viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 16 V62" />
            <path d="M32 46 L50 64 L68 46" />
            <path d="M20 58 V76 Q20 84 28 84 H72 Q80 84 80 76 V58" />
          </svg>
        </div>
        <div className="flex max-w-sm flex-col gap-2">
          <h1 className="text-title-1 text-label">You&apos;re offline</h1>
          <p className="text-body text-label-2">
            AppDrop needs a connection to fetch apps. Pages you&apos;ve visited are still available.
          </p>
        </div>
        <RetryButton />
      </div>
    </main>
  );
}
