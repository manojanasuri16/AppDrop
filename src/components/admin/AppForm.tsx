"use client";
import { useActionState, useEffect, useState } from "react";
import type { ActionState, RepoOption } from "@/app/admin/actions";
import { Field, Section } from "./Field";
import { ImageInput } from "./ImageInput";
import { RepoPicker } from "./RepoPicker";
import { SegmentedControl } from "./SegmentedControl";
import { SubmitButton } from "./SubmitButton";
import { ToggleRow } from "./Toggle";
import { useToast } from "./Toast";
import { PhoneIcon, GlobeIcon } from "./icons";
import { slugify } from "./format";

export type AppDefaults = {
  kind: "android" | "web";
  name: string; slug: string; tagline: string; description: string; category: string; developer: string;
  accentColor: string; packageName: string; repo: string; webUrl: string; assetPattern: string;
  includePrereleases: boolean; visibility: "public" | "unlisted" | "draft"; featured: boolean; sortOrder: number;
  iconUrl: string | null;
};

export const EMPTY_APP: AppDefaults = {
  kind: "android", name: "", slug: "", tagline: "", description: "", category: "Utilities", developer: "",
  accentColor: "#0a84ff", packageName: "", repo: "", webUrl: "", assetPattern: "", includePrereleases: false,
  visibility: "draft", featured: false, sortOrder: 0, iconUrl: null,
};

const humanize = (s: string) => s.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

export function AppForm({
  mode, defaults = EMPTY_APP, action, categories,
}: { mode: "create" | "edit"; categories: readonly string[]; defaults?: AppDefaults; action: (prev: ActionState, form: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const [v, setV] = useState(defaults);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [toast, show] = useToast();
  const set = <K extends keyof AppDefaults>(k: K, val: AppDefaults[K]) => setV((p) => ({ ...p, [k]: val }));
  const fe = state.fieldErrors ?? {};
  const edit = mode === "edit";

  useEffect(() => {
    if (state.ok) show(state.message ?? "Saved");
    else if (state.error && edit) show(state.error, "error");
  }, [state, show, edit]);

  function pickRepo(r: RepoOption | { fullName: string; manual: true }) {
    setV((p) => {
      const next = { ...p, repo: r.fullName };
      if ("manual" in r) return next;
      const short = r.fullName.split("/")[1] ?? "";
      if (!p.name || p.name === humanize(p.repo.split("/")[1] ?? "")) {
        next.name = humanize(short);
      }
      if (!p.tagline && r.description) next.tagline = r.description.slice(0, 120);
      if (p.kind === "web" && !p.webUrl && /^https:\/\//.test(r.homepage)) next.webUrl = r.homepage;
      return next;
    });
  }

  const name = v.name;
  useEffect(() => {
    if (!slugTouched) setV((p) => ({ ...p, slug: slugify(name) }));
  }, [name, slugTouched]);

  const input = (id: keyof AppDefaults & string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => ({
    id, name: id, className: "field", value: String(v[id] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(id, e.target.value as never),
    "aria-invalid": !!fe[id], "aria-describedby": fe[id] ? `${id}-err` : undefined, ...extra,
  });

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.error && !edit && (
        <div role="alert" className="text-subhead rounded-2xl bg-danger/10 px-4 py-3 text-danger">{state.error}</div>
      )}
      {edit && state.error && (
        <div role="alert" className="text-subhead rounded-2xl bg-danger/10 px-4 py-3 text-danger">{state.error}</div>
      )}

      <Section title={edit ? "Type" : "1 · What are you adding?"}>
        <SegmentedControl
          label="App type" name="kind" value={v.kind} onChange={(k) => set("kind", k)}
          options={[
            { value: "android", label: "Android app", icon: <PhoneIcon width={16} height={16} /> },
            { value: "web", label: "Web app", icon: <GlobeIcon width={16} height={16} /> },
          ]}
        />
      </Section>

      <Section
        title={edit ? "Distribution" : "2 · Source"}
        footer={
          v.kind === "android"
            ? "Releases are read from GitHub. Asset pattern: e.g. universal or *-release.apk; leave empty to auto-pick."
            : "Add a repository to show its releases as the changelog."
        }
      >
        {v.kind === "android" ? (
          edit ? (
            <div className="group-list">
              <div className="p-4"><Field id="repo" label="GitHub repository" error={fe.repo}>
                <input {...input("repo", { placeholder: "owner/repo or GitHub URL", autoCapitalize: "off", spellCheck: false })} />
              </Field></div>
              <div className="p-4"><Field id="assetPattern" label="APK asset pattern" optional error={fe.assetPattern} hint="e.g. universal or *-release.apk; leave empty to auto-pick">
                <input {...input("assetPattern", { placeholder: "universal", autoCapitalize: "off", spellCheck: false })} />
              </Field></div>
              <ToggleRow name="includePrereleases" title="Include pre-releases" hint="Betas and release candidates count as the latest version."
                checked={v.includePrereleases} onChange={(b) => set("includePrereleases", b)} />
              <div className="p-4"><Field id="packageName" label="Package name" optional error={fe.packageName}>
                <input {...input("packageName", { placeholder: "com.example.app", autoCapitalize: "off", spellCheck: false })} />
              </Field></div>
            </div>
          ) : (
            <>
              <RepoPicker value={v.repo} onPick={pickRepo} error={fe.repo} />
              <input type="hidden" name="repo" value={v.repo} />
              <input type="hidden" name="includePrereleases" value={v.includePrereleases ? "on" : ""} />
            </>
          )
        ) : (
          <div className="group-list">
            <div className="p-4"><Field id="webUrl" label="Web address" error={fe.webUrl} hint="Must start with https://">
              <input {...input("webUrl", { type: "url", placeholder: "https://myapp.example.com", inputMode: "url", autoCapitalize: "off", required: true })} />
            </Field></div>
            <div className="p-4"><Field id="repo" label="GitHub repository" optional error={fe.repo}>
              <input {...input("repo", { placeholder: "owner/repo", autoCapitalize: "off", spellCheck: false })} />
            </Field></div>
            {edit && (
              <div className="p-4"><Field id="packageName" label="Package name" optional error={fe.packageName}>
                <input {...input("packageName", { placeholder: "com.example.app", autoCapitalize: "off", spellCheck: false })} />
              </Field></div>
            )}
          </div>
        )}
      </Section>

      <Section title={edit ? "Details" : "3 · Details"}>
        <div className="group-list">
          <div className="p-4">
            <ImageInput name="icon" label="App icon" currentUrl={defaults.iconUrl} accent={v.accentColor} error={fe.icon} />
          </div>
          <div className="p-4"><Field id="name" label="Name" error={fe.name}>
            <input {...input("name", { required: true, maxLength: 80, placeholder: "My App", autoComplete: "off" })} />
          </Field></div>
          <div className="p-4"><Field id="slug" label="URL slug" error={fe.slug}
            hint={`Store page: /apps/${v.slug || "…"}`}>
            <input {...input("slug", {
              placeholder: "my-app", autoCapitalize: "off", spellCheck: false, required: true,
              onChange: (e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); },
            })} />
          </Field></div>
          <div className="p-4"><Field id="tagline" label="Tagline" optional error={fe.tagline}>
            <input {...input("tagline", { maxLength: 120, placeholder: "One short line" })} />
          </Field></div>
          {edit && (
            <div className="p-4"><Field id="description" label="Description" optional error={fe.description} hint="Markdown is supported.">
              <textarea
                id="description" name="description" className="field min-h-40" value={v.description}
                onChange={(e) => set("description", e.target.value)} aria-invalid={!!fe.description}
              />
            </Field></div>
          )}
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field id="category" label="Category" error={fe.category}>
              <select id="category" name="category" value={v.category} onChange={(e) => set("category", e.target.value)} className="field">
                {[...new Set<string>([...categories, v.category])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="developer" label="Developer" optional error={fe.developer}>
              <input {...input("developer", { maxLength: 80, placeholder: "You" })} />
            </Field>
          </div>
          <div className="p-4"><Field id="accentColor" label="Accent color" error={fe.accentColor}>
            <div className="flex items-center gap-3">
              <input
                type="color" aria-label="Pick accent color" value={/^#[0-9a-f]{6}$/i.test(v.accentColor) ? v.accentColor : "#0a84ff"}
                onChange={(e) => set("accentColor", e.target.value)}
                className="size-11 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
              <input {...input("accentColor", { maxLength: 7, placeholder: "#0a84ff", autoCapitalize: "off", spellCheck: false })} />
            </div>
          </Field></div>
        </div>
      </Section>

      <Section title="Visibility" footer="Draft apps are visible only to you. Unlisted apps are reachable by link but not shown in the store.">
        <div className="group-list">
          <div className="p-4">
            <SegmentedControl
              label="Visibility" name="visibility" value={v.visibility} onChange={(x) => set("visibility", x)}
              options={[{ value: "public", label: "Public" }, { value: "unlisted", label: "Unlisted" }, { value: "draft", label: "Draft" }]}
            />
          </div>
          {edit && (
            <>
              <ToggleRow name="featured" title="Featured" hint="Highlight on the store front page." checked={v.featured} onChange={(b) => set("featured", b)} />
              <div className="p-4"><Field id="sortOrder" label="Sort order" hint="Lower numbers come first." error={fe.sortOrder}>
                <input {...input("sortOrder", { type: "number", inputMode: "numeric", min: -9999, max: 9999 })} />
              </Field></div>
            </>
          )}
        </div>
      </Section>

      <div className="flex justify-end">
        <SubmitButton pendingLabel={edit ? "Saving…" : "Creating…"} className="w-full sm:w-auto sm:min-w-40">
          {edit ? "Save changes" : "Create app"}
        </SubmitButton>
      </div>
      {toast}
    </form>
  );
}
