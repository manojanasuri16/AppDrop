import { ImageResponse } from "next/og";

export const alt = "AppDrop — apps I've built";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 96px", background: "linear-gradient(160deg, #ffffff 0%, #eef3fb 100%)" }}>
        <div style={{ width: 240, height: 240, borderRadius: 54, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)", boxShadow: "0 24px 60px rgba(10,132,255,0.35)" }}>
          <svg width={134} height={134} viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 16 V62" />
            <path d="M32 46 L50 64 L68 46" />
            <path d="M20 58 V76 Q20 84 28 84 H72 Q80 84 80 76 V58" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72, flex: 1 }}>
          <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -4, color: "#1d1d1f", lineHeight: 1 }}>AppDrop</div>
          <div style={{ marginTop: 24, fontSize: 40, color: "#6e6e73", lineHeight: 1.3 }}>Apps I&apos;ve built — install them straight to your phone.</div>
        </div>
      </div>
    ),
    size,
  );
}
