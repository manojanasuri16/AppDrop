"use client";

import { useEffect, useState } from "react";
import { BLOCK_MESSAGES, fetchTopics, getPushState, PushError, subscribeTopic, unsubscribeTopic, type PushState } from "./push-client";

type Props = {
  topic: string;
  /** "app": icon-only bell for the app header. "store": full-width toggle card content. */
  variant?: "app" | "store";
  className?: string;
};

function Bell({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

/** Shared state machine: loads state, toggles the topic, surfaces human-readable errors. */
function useTopic(topic: string) {
  const [state, setState] = useState<PushState | null>(null);
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await getPushState();
      if (!live) return;
      setState(s);
      if (s.available && !s.blocked) {
        const topics = await fetchTopics();
        if (live) setOn(topics.includes(topic));
      }
    })();
    return () => { live = false; };
  }, [topic]);

  const toggle = async () => {
    if (pending || !state) return;
    setError(null);
    if (state.blocked) {
      setError(BLOCK_MESSAGES[state.blocked]);
      return;
    }
    setPending(true);
    try {
      if (on) {
        await unsubscribeTopic(topic);
        setOn(false);
      } else {
        await subscribeTopic(topic);
        setOn(true);
      }
    } catch (e) {
      const msg = e instanceof PushError ? e.message : "Something went wrong. Please try again.";
      setError(msg);
      if (e instanceof PushError && e.reason === "denied") setState((s) => (s ? { ...s, blocked: "denied" } : s));
    } finally {
      setPending(false);
    }
  };
  return { state, on, pending, error, toggle };
}

export function NotifyButton({ topic, variant = "app", className = "" }: Props) {
  const { state, on, pending, error, toggle } = useTopic(topic);

  if (!state?.available) return null;

  if (variant === "store") {
    return (
      <div className={className}>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h3 id="notify-store" className="text-headline text-label">New apps &amp; updates</h3>
            <p className="mt-0.5 text-subhead text-label-2">Get notified about new apps and updates.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="notify-store"
            disabled={pending}
            onClick={toggle}
            className="pressable relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-300 disabled:opacity-60"
            style={{ background: on ? "var(--tint)" : "var(--fill-strong)" }}
          >
            <span className={`absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-300 ease-[var(--ease-spring)] ${on ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <p role="status" aria-live="polite" className={error ? "mt-2 text-footnote text-danger" : "sr-only"}>
          {error ?? (on ? "Notifications on" : "")}
        </p>
      </div>
    );
  }

  // Icon only, the same size and weight as the share icon beside it: a filled bell means it is on.
  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "Stop notifying me about new versions" : "Notify me about new versions"}
        title={on ? "Notifications on" : "Notify me about new versions"}
        disabled={pending}
        onClick={toggle}
        className="pressable flex h-11 w-11 items-center justify-center rounded-full text-tint hover:bg-fill disabled:opacity-60"
      >
        <Bell filled={on} />
      </button>
      <p role="status" aria-live="polite" className={error ? "absolute right-0 top-full z-10 mt-1 w-60 rounded-xl bg-elevated p-3 text-footnote text-danger shadow-card ring-1 ring-black/5 dark:ring-white/10" : "sr-only"}>
        {error ?? (on ? "Notifications on for this app" : "")}
      </p>
    </div>
  );
}
