"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFeedback, markAllFeedbackRead, setFeedbackRead } from "@/app/admin/actions-growth";
import { ConfirmDialog } from "./ConfirmDialog";
import { SegmentedControl } from "./SegmentedControl";
import { useToast } from "./Toast";
import { CheckIcon, TrashIcon } from "./icons";
import { timeAgo } from "./format";

type Item = {
  id: number; message: string; name: string | null; contact: string | null; appVersion: string | null; source: string;
  createdAt: number; read: boolean; app: { id: number; name: string; iconUrl: string | null; accent: string };
};

const EMAIL = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/;

export function FeedbackInbox({ items, unread, total, apps, filter, appId, now }: {
  items: Item[]; unread: number; total: number; apps: { id: number; name: string }[];
  filter: "all" | "unread"; appId?: number; now: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  const [del, setDel] = useState<Item | null>(null);

  const go = (f: "all" | "unread", app?: number) => {
    const q = new URLSearchParams();
    if (f === "unread") q.set("filter", "unread");
    else if (app) q.set("app", String(app));
    router.push(`/admin/feedback${q.size ? `?${q}` : ""}`);
  };
  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try { await fn(); if (ok) show(ok); router.refresh(); } catch { show("Something went wrong", "error"); }
    });

  return (
    <div className="animate-rise mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-large-title">Feedback</h1>
          <p className="text-subhead mt-1 text-label-2">{total} message{total === 1 ? "" : "s"} · {unread} unread</p>
        </div>
        <button type="button" className="btn-secondary" disabled={pending || unread === 0} onClick={() => run(() => markAllFeedbackRead(), "All marked as read")}>
          <CheckIcon width={18} height={18} />Mark all read
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <SegmentedControl label="Filter" value={filter} onChange={(v) => go(v, undefined)} options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}` }]} />
        </div>
        <select
          aria-label="Filter by app" className="field sm:w-56" value={filter === "unread" ? "" : (appId ?? "")}
          onChange={(e) => go("all", e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All apps</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="group-list px-6 py-14 text-center">
          <h2 className="text-title-3">{filter === "unread" ? "All caught up" : "No feedback yet"}</h2>
          <p className="text-subhead mx-auto mt-1.5 max-w-sm text-label-2">
            {filter === "unread" ? "There are no unread messages." : "Messages sent from an app page or from inside an app will show up here."}
          </p>
        </div>
      ) : (
        <ul className="group-list">
          {items.map((f) => (
            <li key={f.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className={`mt-3 size-2 shrink-0 rounded-full ${f.read ? "bg-transparent" : "bg-tint"}`} aria-label={f.read ? undefined : "Unread"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="squircle grid size-7 shrink-0 place-items-center overflow-hidden text-caption font-bold text-white"
                      style={{ background: f.app.iconUrl ? "var(--fill)" : f.app.accent }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {f.app.iconUrl ? <img src={f.app.iconUrl} alt="" className="size-full object-cover" /> : f.app.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="text-subhead min-w-0 truncate font-semibold">{f.app.name}</span>
                    <span className="text-footnote ml-auto shrink-0 text-label-2">{timeAgo(f.createdAt, now)}</span>
                  </div>
                  <p className={`text-callout mt-2 whitespace-pre-wrap break-words ${f.read ? "" : "font-semibold"}`}>{f.message}</p>
                  <div className="text-footnote mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label-2">
                    {f.name && <span>{f.name}</span>}
                    {f.contact && <span className="break-all">{f.contact}</span>}
                    {f.appVersion && <span>v{f.appVersion.replace(/^v/i, "")}</span>}
                    <span>{f.source === "app" ? "from app" : "from store"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary !h-9 !px-3 !text-footnote" disabled={pending} onClick={() => run(() => setFeedbackRead(f.id, !f.read))}>
                      Mark {f.read ? "unread" : "read"}
                    </button>
                    {f.contact && EMAIL.test(f.contact) && (
                      <a className="btn-secondary !h-9 !px-3 !text-footnote" href={`mailto:${encodeURIComponent(f.contact).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Re: your feedback on ${f.app.name}`)}`}>Reply</a>
                    )}
                    <button type="button" className="btn-secondary !h-9 !px-3 !text-footnote !text-danger" disabled={pending} onClick={() => setDel(f)}>
                      <TrashIcon width={15} height={15} />Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!del} title="Delete this feedback?" message="This permanently removes the message." confirmLabel="Delete" pending={pending}
        onCancel={() => setDel(null)}
        onConfirm={() => { const id = del!.id; run(async () => { await deleteFeedback(id); setDel(null); }, "Deleted"); }}
      />
      {toast}
    </div>
  );
}
