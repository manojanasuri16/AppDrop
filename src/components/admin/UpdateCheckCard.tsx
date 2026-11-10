"use client";
import { useToast } from "./Toast";

export function UpdateCheckCard({ endpoint }: { endpoint: string }) {
  const [toast, show] = useToast();
  return (
    <div className="group-list">
      <div className="p-4">
        <div className="text-footnote font-medium text-label-2">Update-check endpoint</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="text-footnote min-w-0 flex-1 rounded-xl bg-fill px-3 py-2.5 font-mono break-all select-all">{endpoint}</code>
          <button
            type="button" className="btn-secondary"
            onClick={async () => { try { await navigator.clipboard.writeText(endpoint); show("Copied"); } catch { show("Couldn't copy", "error"); } }}
          >Copy</button>
        </div>
        <p className="text-footnote mt-3 text-label-2">Apps published with the AppDrop skill include the update checker automatically.</p>
      </div>
      {toast}
    </div>
  );
}
