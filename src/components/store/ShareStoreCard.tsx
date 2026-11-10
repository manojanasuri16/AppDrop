import { ShareButton } from "./ShareButton";

export const STORE_SHARE_TEXT = "AppDrop — apps I've built. Install them straight to your phone.";

export function ShareStoreCard({ url, qr }: { url: string; qr: string }) {
  return (
    <section aria-labelledby="share-store" className="rounded-[22px] bg-bg-secondary p-5 shadow-card ring-1 ring-black/5 dark:ring-white/10 md:p-7">
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0 flex-1">
          <h2 id="share-store" className="text-title-2 text-label">Share AppDrop</h2>
          <p className="mt-1 max-w-[28ch] text-subhead text-label-2">Send the store to friends, or let them scan the code.</p>
          <ShareButton url={url} title="AppDrop" text={STORE_SHARE_TEXT} variant="pill" qrSvg={qr} className="mt-4" />
        </div>
        {/* SVG generated server-side by us from our own URL — safe to inject. */}
        <div
          role="img"
          aria-label="QR code for AppDrop"
          className="h-[132px] w-[132px] shrink-0 rounded-2xl bg-white p-3 shadow-card ring-1 ring-black/5 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </div>
    </section>
  );
}
