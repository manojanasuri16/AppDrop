"use client";
import { useState, useTransition } from "react";
import { deleteApp } from "@/app/admin/actions";
import { ConfirmDialog } from "./ConfirmDialog";

export function DeleteApp({ appId, name }: { appId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <div className="group-list">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-callout font-medium">Delete this app</div>
            <div className="text-footnote text-label-2">Removes the app, its releases, screenshots and download history. This cannot be undone.</div>
          </div>
          <button type="button" className="btn-secondary !text-danger shrink-0" onClick={() => setOpen(true)}>Delete app…</button>
        </div>
      </div>
      <ConfirmDialog
        open={open} pending={pending} title={`Delete ${name}?`} confirmLabel="Delete forever" requireText={name}
        message={<>Type <strong className="text-label">{name}</strong> to confirm. All data for this app will be permanently removed.</>}
        onCancel={() => setOpen(false)}
        onConfirm={() => start(async () => { await deleteApp(appId); })}
      />
    </>
  );
}
