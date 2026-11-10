import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { isBot, recordPageView, viewSource } from "./stats";

/**
 * Count a page view (store home = appId 0) after the response is sent.
 * `via` comes from ?via=share|qr|app on shared links. Bots and link-preview fetchers are ignored.
 */
export async function trackView(appId: number, via: string | string[] | undefined) {
  const h = await headers();
  if (isBot(h.get("user-agent")) || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) return;
  const source = viewSource(via);
  after(() => recordPageView(appId, source).catch(() => {}));
}
