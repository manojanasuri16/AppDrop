import type { AppCard } from "@/lib/queries";

type Props = {
  app: Pick<AppCard, "kind" | "name">;
  /** Download / open URL (links.get). Plain anchor: never prefetched. */
  href: string;
  size?: "sm" | "lg";
  disabled?: boolean;
  className?: string;
};

export function GetButton({ app, href, size = "sm", disabled, className = "" }: Props) {
  const web = app.kind === "web";
  const label = web ? "Open" : "Get";
  const cls = size === "lg" ? "btn-primary min-w-28" : "btn-get";
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${cls} pointer-events-none opacity-40 ${className}`}>
        {size === "sm" ? label.toUpperCase() : label}
      </span>
    );
  }
  return (
    <a
      href={href}
      aria-label={`${label} ${app.name}`}
      {...(web ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${cls} ${className}`}
    >
      {size === "sm" ? label.toUpperCase() : label}
    </a>
  );
}
