"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { broadcastNotification, type GrowthState } from "@/app/admin/actions-growth";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, Section } from "./Field";
import { ToggleRow } from "./Toggle";
import { useToast } from "./Toast";
import { adminAlertsEnabled, disableAdminAlerts, enableAdminAlerts, pushSupported } from "./push-admin";
import { fmtNum } from "./format";

type AppRow = { id: number; name: string; subscribers: number; sendable: boolean };

export function NotificationsManager({ enabled, devices, all, admin, apps }: {
  enabled: boolean; devices: number; all: number; admin: number; apps: AppRow[];
}) {
  const [toast, show] = useToast();
  const [state, formAction] = useActionState<GrowthState, FormData>(broadcastNotification, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [appId, setAppId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [sending, setSending] = useState(false);
  const seen = useRef<GrowthState>(state);

  useEffect(() => {
    setSupported(pushSupported());
    if (enabled) adminAlertsEnabled().then(setAlerts).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    setSending(false);
    if (state.error) show(state.error, "error");
    else if (state.message) { show(state.message); setTitle(""); setBody(""); }
  }, [state, show]);

  const toggleAlerts = async (on: boolean) => {
    setAlertsBusy(true);
    try {
      if (on) await enableAdminAlerts(); else await disableAdminAlerts();
      setAlerts(on);
      show(on ? "Admin alerts enabled on this device" : "Admin alerts turned off");
    } catch (e) {
      show(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally { setAlertsBusy(false); }
  };

  const target = appId ? apps.find((a) => String(a.id) === appId) : null;
  const reach = target ? `${target.name} subscribers and everyone subscribed to all updates` : "everyone subscribed to all updates";
  const valid = title.trim().length > 0 && title.length <= 80 && body.length <= 200;
  const Counter = ({ n, max }: { n: number; max: number }) => <span className={n > max ? "text-danger" : ""}>{n}/{max}</span>;

  return (
    <div className="animate-rise mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-large-title">Notifications</h1>
        <p className="text-subhead mt-2 text-label-2">
          New stable releases are announced automatically to people who subscribed to that app or to all updates. Use a broadcast for anything else, like a web app update.
        </p>
      </div>

      {!enabled ? (
        <div role="note" className="text-subhead rounded-2xl bg-warning/15 px-4 py-4">
          <strong className="font-semibold">Push isn&rsquo;t configured</strong>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Run <code className="rounded bg-fill px-1">npx web-push generate-vapid-keys</code></li>
            <li>In Vercel, set <code className="rounded bg-fill px-1">VAPID_PUBLIC_KEY</code>, <code className="rounded bg-fill px-1">VAPID_PRIVATE_KEY</code> and <code className="rounded bg-fill px-1">VAPID_SUBJECT=mailto:you@example.com</code></li>
            <li>Redeploy</li>
          </ol>
        </div>
      ) : (
        <>
          <Section title="Subscribers">
            <dl className="grid grid-cols-2 gap-3">
              {[["Devices", devices], ["All updates", all]].map(([l, n]) => (
                <div key={l} className="rounded-2xl bg-elevated p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                  <dt className="text-footnote text-label-2">{l}</dt>
                  <dd className="text-title-1 mt-1 tabular-nums">{fmtNum(Number(n))}</dd>
                </div>
              ))}
            </dl>
            {apps.length > 0 && (
              <ul className="group-list mt-3">
                {apps.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-callout min-w-0 truncate">{a.name}</span>
                    <span className="text-callout shrink-0 tabular-nums text-label-2">{fmtNum(a.subscribers)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="This device" footer={supported ? `Get a push when new feedback arrives. ${admin} device${admin === 1 ? "" : "s"} currently get admin alerts.` : "This browser doesn't support push notifications. On iPhone, add AppDrop to the Home Screen first."}>
            <div className="group-list">
              <ToggleRow title="Admin alerts on this device" hint="New feedback pings you" checked={alerts} disabled={alertsBusy || !supported} onChange={toggleAlerts} />
            </div>
          </Section>

          <Section title="Broadcast">
            <form ref={formRef} action={(fd) => { setSending(true); formAction(fd); setConfirm(false); }} className="group-list">
              <div className="p-4">
                <Field id="appId" label="Send to">
                  <select id="appId" name="appId" className="field" value={appId} onChange={(e) => setAppId(e.target.value)}>
                    <option value="">All subscribers</option>
                    {apps.filter((a) => a.sendable).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="p-4">
                <Field id="title" label="Title" hint={undefined}>
                  <input id="title" name="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="NewPipe 0.28 is out" autoComplete="off" />
                  <div className="text-caption text-right text-label-2 tabular-nums"><Counter n={title.length} max={80} /></div>
                </Field>
              </div>
              <div className="p-4">
                <Field id="body" label="Message" optional>
                  <textarea id="body" name="body" rows={3} className="field" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What's new" />
                  <div className="text-caption text-right text-label-2 tabular-nums"><Counter n={body.length} max={200} /></div>
                </Field>
              </div>
              <div className="p-4">
                <div className="text-footnote mb-2 font-medium text-label-2">Preview</div>
                <div className="material flex items-start gap-3 rounded-2xl p-3" style={{ boxShadow: "inset 0 0 0 0.5px var(--separator)" }}>
                  <span className="squircle grid size-10 shrink-0 place-items-center bg-tint text-callout font-bold text-white">{(target?.name ?? "A").slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="text-subhead truncate font-semibold">{title || "Title"}</div>
                    <div className="text-footnote line-clamp-3 break-words whitespace-pre-wrap text-label-2">{body || "Message"}</div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <button type="button" className="btn-primary w-full sm:w-auto" disabled={!valid || sending} onClick={() => setConfirm(true)}>Send broadcast…</button>
              </div>
            </form>
          </Section>
        </>
      )}

      <ConfirmDialog
        open={confirm} title="Send this notification?" confirmLabel="Send"
        message={<>It will be pushed to {reach}. This can&rsquo;t be undone.</>}
        onCancel={() => setConfirm(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      {toast}
    </div>
  );
}
