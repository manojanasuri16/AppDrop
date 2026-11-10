"use client";
import { useId } from "react";

export type Segment<T extends string> = { value: T; label: string; icon?: React.ReactNode };

export function SegmentedControl<T extends string>({
  value, onChange, options, name, label, size = "md", disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Segment<T>[];
  name?: string;
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const id = useId();
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const h = size === "sm" ? "h-9" : "h-11";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      className={`relative grid w-full ${h} rounded-[10px] bg-fill p-[2px] ${disabled ? "opacity-60" : ""}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <span
        aria-hidden
        className="absolute top-[2px] bottom-[2px] rounded-[8px] bg-elevated transition-transform duration-300 [transition-timing-function:var(--ease-spring)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          left: 2,
          transform: `translateX(${idx * 100}%)`,
          boxShadow: "0 1px 3px rgba(0,0,0,.14), 0 0 0 0.5px rgba(0,0,0,.04)",
        }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            id={`${id}-${o.value}`}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-[8px] px-2 ${size === "sm" ? "text-footnote" : "text-subhead"} font-semibold transition-colors ${on ? "text-label" : "text-label-2"}`}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
