import "server-only";
import { isAdmin } from "./auth";
import { findPublicApp } from "./public-app";
import type { Topic } from "./push";

/** Map a client topic ("all" | "app:<slug>" | "admin") to a stored topic, enforcing access. */
export async function resolveTopic(raw: unknown): Promise<Topic | null> {
  if (raw === "all") return "all";
  if (raw === "admin") return (await isAdmin()) ? "admin" : null;
  if (typeof raw === "string" && raw.startsWith("app:")) {
    const app = await findPublicApp(raw.slice(4));
    return app ? `app:${app.id}` : null;
  }
  return null;
}
