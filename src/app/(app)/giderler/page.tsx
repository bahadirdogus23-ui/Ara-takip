import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { DeleteButton } from "@/components/form";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { formatDateTR, formatTL, isoDateTR } from "@/lib/format";
import { expenseTotals, toKurus, toTL } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/validation";
import { deleteExpense } from "./actions";
import { ExpenseForm } from "./expense-form";

export const metadata = { title: "Giderler" };

const LIMIT = 500;
const categoryLabel = (c: string) => EXPENSE_CATEGORIES[c as keyof typeof EXPENSE_CATEGORIES] ?? c;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string; bas?: string; bit?: string }>;
}) {
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/panel");

  const [{ data: sites }, { data: items }] = await Promise.all([
    supabase.from("sites").select("id, name, status").eq("tenant_id", tenant.id).order("name"),
    supabase.from("work_items").select("id, site_id, code, name").eq("tenant_id", tenant.id).order("name"),
  ]);
  const { siteId, from, to } = readFilters(await searchParams, (sites ?? []).map((s) => s.id));
  const siteName = new Map(sites?.map((s) => [s.id, s.name]));
  const itemName = new Map(items?.map((i) => [i.id, i.name]));

  let q = supabase
    .from("expenses")
    .select("id, site_id, work_item_id, expense_date, category, amount, vat_rate, supplier, description")
    .eq("tenant_id", tenant.id)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (siteId) q = q.eq("site_id", siteId);
  const { data: rows, error } = await q;
  if (error) throw new Error("Giderler alınamadı");

  const { net, vat, total } = expenseTotals(rows);
  const byCategory = new Map<string, number>(); // kuruş
  rows.forEach((r) => byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + toKurus(Number(r.amount))));

  const activeSites = (sites ?? []).filter((s) => s.status === "active");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Giderler</h1>

      {activeSites.length > 0 && (
        <details className="card" open={rows.length === 0}>
          <summary className="cursor-pointer font-semibold">Yeni gider</summary>
          <div className="mt-4">
            <ExpenseForm
              sites={activeSites.map((s) => ({ value: s.id, label: s.name }))}
              items={(items ?? [])
                .filter((i) => activeSites.some((s) => s.id === i.site_id))
                .map((i) => ({ value: i.id, label: `${i.code ? `${i.code} · ` : ""}${i.name}`, group: siteName.get(i.site_id) }))}
              defaultSiteId={siteId || (activeSites.length === 1 ? activeSites[0].id : "")}
              today={isoDateTR()}
              requestId={randomUUID()}
            />
          </div>
        </details>
      )}

      <FilterBar sites={sites ?? []} siteId={siteId} from={from} to={to} />

      {rows.length === 0 ? (
        <p className="card text-sm text-muted">Bu aralıkta gider yok.</p>
      ) : (
        <>
          <section className="card grid gap-4 sm:grid-cols-2">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">KDV hariç</dt>
              <dd className="text-right font-semibold tabular-nums">{formatTL(net)}</dd>
              <dt className="text-muted">KDV</dt>
              <dd className="text-right tabular-nums">{formatTL(vat)}</dd>
              <dt className="font-semibold">Toplam</dt>
              <dd className="text-right text-lg font-bold tabular-nums">{formatTL(total)}</dd>
            </dl>
            <ul className="space-y-1 text-sm">
              {[...byCategory].map(([c, a]) => (
                <li key={c} className="flex justify-between gap-3">
                  <span className="text-muted">{categoryLabel(c)}</span>
                  <span className="tabular-nums">{formatTL(toTL(a))}</span>
                </li>
              ))}
            </ul>
            {rows.length === LIMIT && <p className="text-xs text-amber-700">İlk {LIMIT} kayıt gösteriliyor; aralığı daraltın.</p>}
          </section>

          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p>
                    <span className="text-muted">{formatDateTR(r.expense_date)}</span>{" "}
                    <span className="font-semibold tabular-nums">{formatTL(r.amount)}</span> {categoryLabel(r.category)}
                    <span className="text-muted"> · KDV %{Number(r.vat_rate)}</span>
                  </p>
                  <p className="text-muted">
                    {[
                      !siteId && siteName.get(r.site_id),
                      r.work_item_id && `→ ${itemName.get(r.work_item_id)}`,
                      r.supplier,
                      r.description,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <DeleteButton action={deleteExpense} id={r.id} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
