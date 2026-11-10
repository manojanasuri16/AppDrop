import { z } from "zod";

export function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (!s) return null;
  const m = s.match(/^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost");
    } catch {
      return false;
    }
  }, "Must be an https:// URL");

export const appFields = z
  .object({
    kind: z.enum(["android", "web"]),
    name: z.string().trim().min(1, "Name is required").max(80),
    slug: z
      .string()
      .trim()
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    tagline: z.string().trim().max(120).default(""),
    description: z.string().max(20_000).default(""),
    category: z.string().trim().min(1).max(40).default("Utilities"),
    developer: z.string().trim().max(80).default(""),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0a84ff").default("#0a84ff"),
    packageName: z
      .string()
      .trim()
      .max(200)
      .regex(/^$|^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/, "Invalid package name")
      .default(""),
    repo: z.string().trim().max(300).default(""),
    webUrl: z.union([z.literal(""), httpsUrl]).default(""),
    assetPattern: z.string().trim().max(100).default(""),
    includePrereleases: z.boolean().default(false),
    visibility: z.enum(["public", "unlisted", "draft"]).default("draft"),
    featured: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(-9999).max(9999).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.repo && !parseRepo(v.repo)) ctx.addIssue({ code: "custom", path: ["repo"], message: "Use owner/repo or a GitHub URL" });
    if (v.kind === "android" && !v.repo) ctx.addIssue({ code: "custom", path: ["repo"], message: "Android apps need a GitHub repository" });
    if (v.kind === "web" && !v.webUrl) ctx.addIssue({ code: "custom", path: ["webUrl"], message: "Web apps need a deployed URL" });
  });

export type AppFields = z.infer<typeof appFields>;
