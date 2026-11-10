"use client";

export function Toggle({
  checked, onChange, name, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; name?: string; label: string; disabled?: boolean }) {
  return (
    <>
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-50"
        style={{ background: checked ? "var(--success)" : "var(--fill-strong)" }}
      >
        <span
          className="absolute left-[2px] size-[27px] rounded-full bg-white transition-transform duration-300 [transition-timing-function:var(--ease-spring)]"
          style={{ transform: `translateX(${checked ? 20 : 0}px)`, boxShadow: "0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16)" }}
        />
      </button>
    </>
  );
}

/** A grouped-list row with a title, optional hint and a switch. */
export function ToggleRow({
  title, hint, ...rest
}: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; name?: string; disabled?: boolean }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <div className="text-callout">{title}</div>
        {hint && <div className="text-footnote text-label-2">{hint}</div>}
      </div>
      <Toggle label={title} {...rest} />
    </div>
  );
}
