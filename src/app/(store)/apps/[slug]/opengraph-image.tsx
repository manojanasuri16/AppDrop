import { STORE_TAGLINE } from "@/lib/brand";
import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { getAppBySlug } from "@/lib/queries";
import { db, dbReady } from "@/db";
import { media } from "@/db/schema";

export const dynamic = "force-dynamic";
export const alt = "App on AppDrop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function iconDataUrl(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  await dbReady();
  const row = await db.select({ mime: media.mime, data: media.data }).from(media).where(eq(media.id, id)).get();
  if (!row || !/^image\/(png|jpeg)$/.test(row.mime)) return null;
  return `data:${row.mime};base64,${Buffer.from(row.data).toString("base64")}`;
}

function Glyph({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 16 V62" />
      <path d="M32 46 L50 64 L68 46" />
      <path d="M20 58 V76 Q20 84 28 84 H72 Q80 84 80 76 V58" />
    </svg>
  );
}

function StoreCard() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 96px", background: "linear-gradient(160deg, #ffffff 0%, #eef3fb 100%)" }}>
      <div style={{ width: 240, height: 240, borderRadius: 54, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)" }}>
        <Glyph px={134} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 72 }}>
        <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -4, color: "#1d1d1f", lineHeight: 1 }}>AppDrop</div>
        <div style={{ marginTop: 24, fontSize: 40, color: "#6e6e73" }}>{STORE_TAGLINE}.</div>
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getAppBySlug(slug);
  if (!app) return new ImageResponse(<StoreCard />, size);

  const icon = await iconDataUrl(app.raw.iconMediaId);
  const accent = /^#[0-9a-f]{6}$/i.test(app.accentColor) ? app.accentColor : "#0a84ff";
  const kindLine = app.kind === "web" ? "Web app" : `Android app${(app.latestVersion ?? app.latest?.tag) ? ` · ${app.latestVersion ?? app.latest?.tag}` : ""}`;
  const nameSize = app.name.length > 22 ? 64 : app.name.length > 14 ? 80 : 96;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "72px 96px 56px", background: `linear-gradient(160deg, #ffffff 0%, ${accent}1a 100%)` }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} width={280} height={280} alt="" style={{ borderRadius: 64, objectFit: "cover", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }} />
          ) : (
            <div style={{ width: 280, height: 280, borderRadius: 64, display: "flex", alignItems: "center", justifyContent: "center", background: accent, color: "#fff", fontSize: 140, fontWeight: 700, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
              {(app.name.trim()[0] ?? "?").toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 64, flex: 1 }}>
            <div style={{ fontSize: nameSize, fontWeight: 700, letterSpacing: -3, color: "#1d1d1f", lineHeight: 1.05 }}>{app.name}</div>
            {app.tagline && <div style={{ marginTop: 20, fontSize: 38, color: "#6e6e73", lineHeight: 1.3, maxHeight: 100, overflow: "hidden" }}>{app.tagline.slice(0, 110)}</div>}
            <div style={{ marginTop: 28, fontSize: 30, fontWeight: 600, color: accent }}>{kindLine}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)" }}>
            <Glyph px={26} />
          </div>
          <div style={{ marginLeft: 16, fontSize: 30, fontWeight: 700, color: "#1d1d1f" }}>AppDrop</div>
        </div>
      </div>
    ),
    size,
  );
}
