"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchRepos, type RepoOption } from "@/app/admin/actions";
import { LockIcon, SearchIcon, CheckIcon, SpinnerIcon } from "./icons";

export function RepoPicker({
  value, onPick, error,
}: { value: string; onPick: (repo: RepoOption | { fullName: string; manual: true }) => void; error?: string }) {
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    fetchRepos()
      .then((r) => { if (!live) return; setRepos(r.repos); setLoadErr(r.error ?? null); })
      .catch(() => { if (live) { setRepos([]); setLoadErr("Could not load repositories"); } });
    return () => { live = false; };
  }, []);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (repos ?? []).filter((r) => !n || r.fullName.toLowerCase().includes(n) || r.description.toLowerCase().includes(n));
  }, [repos, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="group-list">
        <div className="relative">
          <SearchIcon width={18} height={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-label-3" />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your repositories"
            aria-label="Search repositories" className="h-12 w-full bg-transparent pr-4 pl-11 text-body outline-none placeholder:text-label-3"
          />
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain" role="listbox" aria-label="Repositories">
          {repos === null && (
            <div className="text-subhead flex items-center gap-2 px-4 py-6 text-label-2"><SpinnerIcon width={16} height={16} /> Loading repositories…</div>
          )}
          {repos !== null && list.length === 0 && (
            <div className="text-subhead px-4 py-6 text-center text-label-2">
              {loadErr ?? (q ? "No matching repositories" : "No repositories found")}
            </div>
          )}
          {list.map((r) => {
            const on = r.fullName.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={r.fullName} type="button" role="option" aria-selected={on} onClick={() => onPick(r)}
                className="pressable flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-fill"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-callout flex items-center gap-1.5 font-medium">
                    <span className="truncate">{r.fullName}</span>
                    {r.private && <LockIcon width={14} height={14} className="shrink-0 text-label-2" aria-label="Private repository" role="img" />}
                  </div>
                  {r.description && <div className="text-footnote truncate text-label-2">{r.description}</div>}
                </div>
                {on && <CheckIcon width={18} height={18} className="shrink-0 text-tint" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="repo-manual" className="text-footnote font-medium text-label-2">Or enter manually</label>
        <input
          id="repo-manual" className="field" value={value} placeholder="owner/repo or GitHub URL" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          aria-invalid={!!error} aria-describedby={error ? "repo-manual-err" : undefined}
          onChange={(e) => onPick({ fullName: e.target.value, manual: true })}
        />
        {error && <p id="repo-manual-err" role="alert" className="text-footnote text-danger">{error}</p>}
      </div>
    </div>
  );
}
