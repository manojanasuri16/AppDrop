type Props = {
  name: string;
  iconUrl: string | null;
  accentColor: string;
  size?: number;
  className?: string;
  priority?: boolean;
};

export function AppIcon({ name, iconUrl, accentColor, size = 64, className = "", priority }: Props) {
  // Must be a block-level box: width/height/border-radius are ignored on inline elements,
  // which made real (uploaded) icons render at their natural 512px size with square corners.
  const base = `squircle relative shrink-0 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 ${className}`;
  const style = { width: size, height: size };
  if (iconUrl) {
    return (
      <span className={`${base} block bg-secondary`} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt={`${name} icon`}
          width={size}
          height={size}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }
  const c = accentColor || "#0a84ff";
  return (
    <span
      role="img"
      aria-label={`${name} icon`}
      className={`${base} flex items-center justify-center font-semibold text-white`}
      style={{
        ...style,
        background: `linear-gradient(145deg, ${c}, color-mix(in srgb, ${c} 62%, #000))`,
        fontSize: size * 0.44,
        letterSpacing: "-0.02em",
      }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
