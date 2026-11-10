"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBetaInvite, revokeBetaInvite, type GrowthState } from "@/app/admin/actions-growth";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, Section } from "./Field";
import { SubmitButton } from "./SubmitButton";
import { useToast } from "./Toast";
import { timeAgo } from "./format";

type Invite = { id: number; label: string; uses: number; createdAt: number; lastUsedAt: number | null; revoked: boolean };

export function BetaManager({ invites, now }: { invites: Invite[]; now: number }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [state, formAction] = useActionState<GrowthState, FormData>(createBetaInvite, {});
  const [pending, start] = useTransition();
  const [rev, setRev] = useState<Invite | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); show("Link copied"); } catch { show("Couldn't copy: select the link manually", "error"); }
  };
  const share = async (url: string) => {
    try { await navigator.share({ title: "AppDrop beta", url }); } catch { /* cancelled */ }
  };

  return (
    <div className="animate-rise mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-large-title">Beta</h1>
        <p className="text-subhead mt-2 text-label-2">
          The beta channel lets chosen people try pre-release versions before everyone else. Send a tester an invite link: opening it on their device
          unlocks pre-release builds in the store for them only, while everyone else keeps seeing stable releases. To publish a beta build, mark the
          GitHub release as a pre-release. (Apps with &ldquo;Show pre-releases to everyone&rdquo; on show them to all visitors.)
        </p>
      </div>

      <Section title="New invite">
        <form action={formAction} className="group-list">
          <div className="p-4">
            <Field id="label" label="Label" hint="Who is it for? Only you see this." error={state.error}>
              <input id="label" name="label" className="field" maxLength={80} required placeholder="Ravi's phone" autoComplete="off" />
            </Field>
          </div>
          <div className="p-4"><SubmitButton pendingLabel="Creating…" className="w-full sm:w-auto">Create invite link</SubmitButton></div>
        </form>
        {state.ok && state.link && (
          <div role="status" className="mt-3 rounded-2xl bg-tint/10 p-4" style={{ boxShadow: "inset 0 0 0 1.5px var(--tint)" }}>
            <div className="text-subhead font-semibold">Invite link</div>
            <code className="text-footnote mt-2 block break-all rounded-xl bg-elevated p-3 font-mono select-all">{state.link}</code>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => copy(state.link!)}>Copy</button>
              {canShare && <button type="button" className="btn-secondary" onClick={() => share(state.link!)}>Share…</button>}
            </div>
            <p className="text-footnote mt-3 font-medium text-warning">This link won&rsquo;t be shown again. Copy it now.</p>
          </div>
        )}
      </Section>

      <Section title="Invites">
        {invites.length === 0 ? (
          <div className="group-list text-subhead px-6 py-10 text-center text-label-2">No invites yet.</div>
        ) : (
          <ul className="group-list">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2">
                    <span className="text-callout truncate font-semibold">{i.label}</span>
                    <span className={`text-caption shrink-0 rounded-full px-2 py-0.5 font-semibold ${i.revoked ? "bg-fill text-label-2" : "bg-success/15 text-success"}`}>{i.revoked ? "Revoked" : "Active"}</span>
                  </div>
                  <div className="text-footnote mt-1 text-label-2">
                    {i.uses} use{i.uses === 1 ? "" : "s"} · last used {i.lastUsedAt ? timeAgo(i.lastUsedAt, now) : "never"} · created {timeAgo(i.createdAt, now)}
                  </div>
                </div>
                {!i.revoked && (
                  <button type="button" className="btn-secondary !h-9 !px-3 !text-footnote !text-danger" onClick={() => setRev(i)}>Revoke</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ConfirmDialog
        open={!!rev} title={`Revoke “${rev?.label ?? ""}”?`} message="The link stops working and devices that already used it lose pre-release access immediately." confirmLabel="Revoke" pending={pending}
        onCancel={() => setRev(null)}
        onConfirm={() => start(async () => {
          try { await revokeBetaInvite(rev!.id); show("Invite revoked"); setRev(null); router.refresh(); } catch { show("Something went wrong", "error"); }
        })}
      />
      {toast}
    </div>
  );
}
