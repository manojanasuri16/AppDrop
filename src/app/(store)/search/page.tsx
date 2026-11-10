import { listPublicApps } from "@/lib/queries";
import { AppRow } from "@/components/store/AppRow";
import { LiveSearch } from "@/components/store/LiveSearch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const category = (sp.category ?? "").trim();
  const all = await listPublicApps();
  const categories = [...new Set(all.map((a) => a.category))].sort();
  const items = all.map((a, i) => ({
    key: a.id,
    category: a.category,
    haystack: [a.name, a.tagline, a.category, a.developer].join("\n").toLowerCase(),
    row: <AppRow app={a} index={i} />,
  }));

  return (
    <div className="pt-7 md:pt-12">
      <h1 className="animate-rise text-large-title text-label">Search</h1>
      <LiveSearch items={items} categories={categories} initialQ={q} initialCategory={category} />
    </div>
  );
}
