import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { db, dbReady } from "@/db";
import { feedback, type App } from "@/db/schema";
import { sendToTopics } from "./push";

export const feedbackInput = z.object({
  message: z.string().trim().min(3, "Please write a little more").max(4000, "Keep it under 4000 characters"),
  name: z.string().trim().max(80).optional().default(""),
  contact: z.string().trim().max(200).optional().default(""),
  version: z.string().trim().max(50).regex(/^[\w.+-]*$/, "Invalid version").optional().default(""),
  /** Honeypot: real users never fill this (hidden field). */
  website: z.string().optional().default(""),
});

export type FeedbackResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

export async function submitFeedback(app: Pick<App, "id" | "slug" | "name">, raw: unknown, source: "web" | "app"): Promise<FeedbackResult> {
  const parsed = feedbackInput.safeParse(raw ?? {});
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? "message")] ??= i.message;
    return { ok: false, error: "Please check the form", fields };
  }
  const d = parsed.data;
  if (d.website) return { ok: true }; // silently drop bots
  await dbReady();
  await db.insert(feedback).values({
    appId: app.id, message: d.message, name: d.name, contact: d.contact, appVersion: d.version, source,
  });
  // Alert the owner's devices (admin topic) without delaying the response.
  after(() =>
    sendToTopics(["admin"], {
      title: `Feedback · ${app.name}`,
      body: (d.name ? `${d.name}: ` : "") + d.message,
      url: "/admin/feedback",
      tag: `feedback-${app.slug}`,
    }).then(() => undefined),
  );
  return { ok: true };
}
