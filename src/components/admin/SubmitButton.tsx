"use client";
import { useFormStatus } from "react-dom";
import { SpinnerIcon } from "./icons";

export function SubmitButton({
  children, pendingLabel, variant = "primary", className = "", disabled,
}: { children: React.ReactNode; pendingLabel?: string; variant?: "primary" | "secondary" | "danger"; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const cls = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-secondary !bg-danger !text-white";
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={`${cls} ${className}`}>
      {pending && <SpinnerIcon width={18} height={18} />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
