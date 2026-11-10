"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon } from "./icons";

export type ToastMsg = { id: number; text: string; kind: "success" | "error" };

/** Returns [node to render, show()]. Render `node` once anywhere in the component. */
export function useToast() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const seq = useRef(0);
  const show = useCallback((text: string, kind: "success" | "error" = "success") => {
    setMsg({ id: ++seq.current, text, kind });
  }, []);
  const node = <Toast msg={msg} onDone={() => setMsg(null)} />;
  return [node, show] as const;
}

export function Toast({ msg, onDone }: { msg: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, msg.kind === "error" ? 6000 : 2800);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" aria-live="polite" role="status">
      {msg && (
        <div
          key={msg.id}
          className="material animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-subhead font-medium shadow-float"
          style={{ boxShadow: "var(--shadow-float), inset 0 0 0 0.5px var(--separator)" }}
        >
          <span className={`grid size-5 shrink-0 place-items-center rounded-full text-white ${msg.kind === "success" ? "bg-success" : "bg-danger"}`}>
            {msg.kind === "success" ? <CheckIcon width={13} height={13} strokeWidth={3} /> : <span className="text-caption font-bold leading-none">!</span>}
          </span>
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
