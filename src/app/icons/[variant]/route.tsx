import { ImageResponse } from "next/og";

const GRADIENT = "linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)";
const CACHE_CONTROL = "public, max-age=86400";

type Variant = {
  size: number;
  /** Rounded-corner radius as a fraction of the canvas (null = full bleed). */
  radius: number | null;
  /** Glyph box as a fraction of the canvas. */
  glyph: number;
};

// Glyph fits the 80% maskable safe zone; "any" icons are squircle tiles on transparent.
const VARIANTS: Record<string, Variant> = {
  "192": { size: 192, radius: 0.225, glyph: 0.56 },
  "512": { size: 512, radius: 0.225, glyph: 0.56 },
  "maskable-512": { size: 512, radius: null, glyph: 0.46 },
  apple: { size: 180, radius: null, glyph: 0.56 },
  favicon: { size: 64, radius: 0.225, glyph: 0.6 },
};

/** Arrow dropping into a tray, drawn on a 100x100 grid. */
function Glyph({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 16 V62" />
      <path d="M32 46 L50 64 L68 46" />
      <path d="M20 58 V76 Q20 84 28 84 H72 Q80 84 80 76 V58" />
    </svg>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const spec = Object.prototype.hasOwnProperty.call(VARIANTS, variant) ? VARIANTS[variant] : undefined;
  if (!spec) {
    return new Response("Not found", { status: 404 });
  }

  const { size, radius, glyph } = spec;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: GRADIENT,
          borderRadius: radius === null ? 0 : size * radius,
        }}
      >
        <Glyph px={size * glyph} />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": CACHE_CONTROL },
    },
  );
}
