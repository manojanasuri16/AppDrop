import Link from "next/link";

export default function NotFound() {
  return (
    <section className="animate-rise flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <div className="squircle flex h-24 w-24 items-center justify-center bg-fill text-label-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4M9 11h4" />
        </svg>
      </div>
      <h1 className="mt-6 text-title-1 text-label">Nothing here</h1>
      <p className="mt-2 max-w-[30ch] text-body text-label-2">This app doesn&apos;t exist, or it hasn&apos;t been published yet.</p>
      <Link href="/" className="btn-primary mt-7">Back to Today</Link>
    </section>
  );
}
