import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { CATEGORIES } from "@/lib/queries";
import { AppForm } from "@/components/admin/AppForm";
import { ArrowLeft } from "@/components/admin/icons";
import { createApp } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewAppPage() {
  await requireAdmin();
  return (
    <div className="animate-rise mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin" className="pressable text-subhead -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-tint"><ArrowLeft width={18} height={18} />Apps</Link>
        <h1 className="text-large-title mt-1">New App</h1>
      </div>
      {!env.githubToken && (
        <div role="note" className="text-subhead rounded-2xl bg-warning/15 px-4 py-3">
          <strong className="font-semibold">GitHub token not configured</strong> — only public repos work.
        </div>
      )}
      <AppForm mode="create" action={createApp} categories={CATEGORIES} />
    </div>
  );
}
