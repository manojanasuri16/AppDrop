"use client";
import { useTransition } from "react";
import type { ActionState } from "@/app/admin/actions";
import { useToast } from "./Toast";
import { SpinnerIcon } from "./icons";

/** Runs a server action returning ActionState and reports the result as a toast. */
export function ActionButton({
  action, children, pendingLabel, variant = "secondary", className = "", icon,
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
  icon?: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} disabled:opacity-60 ${className}`}
        onClick={() =>
          start(async () => {
            try {
              const r = await action();
              if (r.error) show(r.error, "error");
              else show(r.message ?? "Done");
            } catch {
              show("Something went wrong", "error");
            }
          })
        }
      >
        {pending ? <SpinnerIcon width={18} height={18} /> : icon}
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {toast}
    </>
  );
}
