"use client";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { addScreenshots, removeScreenshot, reorderScreenshots, type ActionState } from "@/app/admin/actions";
import { ArrowLeft, ArrowRight, ImageIcon, TrashIcon } from "./icons";
import { SubmitButton } from "./SubmitButton";
import { useToast } from "./Toast";

export type Shot = { id: string; url: string };

export function ScreenshotManager({ appId, shots }: { appId: number; shots: Shot[] }) {
  const [opt, setOpt] = useOptimistic(shots, (_cur, next: Shot[]) => next);
  const [, start] = useTransition();
  const [toast, show] = useToast();
  const [state, formAction] = useActionState(addScreenshots.bind(null, appId), {} as ActionState);
  const [count, setCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) { show(state.message ?? "Added"); setCount(0); }
    else if (state.error) show(state.error, "error");
  }, [state, show]);

  const move = (i: number, d: -1 | 1) => {
    const next = [...opt];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    start(async () => { setOpt(next); await reorderScreenshots(appId, next.map((s) => s.id)); });
  };
  const remove = (id: string) =>
    start(async () => { setOpt(opt.filter((s) => s.id !== id)); await removeScreenshot(appId, id); });

  return (
    <div className="flex flex-col gap-4">
      {opt.length > 0 ? (
        <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1" aria-label="Screenshots">
          {opt.map((s, i) => (
            <li key={s.id} className="w-36 shrink-0">
              <div className="relative overflow-hidden rounded-2xl bg-fill" style={{ boxShadow: "inset 0 0 0 0.5px var(--separator)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={`Screenshot ${i + 1}`} className="aspect-[9/19] w-full object-cover" loading="lazy" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move screenshot ${i + 1} left`} className="pressable grid size-11 place-items-center rounded-full text-label-2 hover:bg-fill disabled:opacity-30"><ArrowLeft width={18} height={18} /></button>
                <button type="button" onClick={() => remove(s.id)} aria-label={`Remove screenshot ${i + 1}`} className="pressable grid size-11 place-items-center rounded-full text-danger hover:bg-fill"><TrashIcon width={18} height={18} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === opt.length - 1} aria-label={`Move screenshot ${i + 1} right`} className="pressable grid size-11 place-items-center rounded-full text-label-2 hover:bg-fill disabled:opacity-30"><ArrowRight width={18} height={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-subhead flex flex-col items-center gap-2 rounded-2xl bg-fill px-4 py-8 text-center text-label-2">
          <ImageIcon width={28} height={28} />
          No screenshots yet.
        </div>
      )}
      <form action={formAction} className="flex flex-wrap items-center gap-3" onReset={() => setCount(0)}>
        <label className="btn-secondary cursor-pointer">
          <ImageIcon width={18} height={18} />
          {count ? `${count} selected` : "Choose images"}
          <input
            ref={fileRef} type="file" name="screenshots" multiple accept="image/png,image/jpeg,image/webp" className="sr-only"
            aria-label="Screenshot images" onChange={(e) => setCount(e.target.files?.length ?? 0)}
          />
        </label>
        <SubmitButton pendingLabel="Uploading…" disabled={!count}>Upload</SubmitButton>
        <p className="text-footnote w-full text-label-2">PNG, JPEG or WebP, up to 4 MB each, 12 at a time.</p>
      </form>
      {toast}
    </div>
  );
}
