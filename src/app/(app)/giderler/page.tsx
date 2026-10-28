import { randomUUID } from "node:crypto";
import { Truck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { DeleteButton } from "@/components/form";
import { RecordEdit } from "@/components/record-edit";
import { loadContractorPayments } from "@/lib/contractor";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { formatDateTR, formatTL, isoDateTR } from "@/lib/format";
import { expenseTotals, toKurus, toTL } from "@/lib/money";
import { formatTrNumber } from "@/lib/number";
import { fetchAll } from "@/lib/summaries";
import { EXPENSE_CATEGORIES } from "@/lib/validation";
import { deleteExpense, updateExpense } from "./actions";
import { ExpenseForm } from "./expense-form";

export const metadata = { title: "Giderler" };

const LIMIT = 500;
const categoryLabel = (c: string) =>
  EXPENSE_CATEGORIES[c as keyof typeof EXPENSE_CATEGORIES] ?? c;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string; bas?: string; bit?: string }>;
}) {
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/panel");

  const [{ data: sites }, { data: items }] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, status")
      .eq("tenant_id", tenant.id)
      .order("name"),
    supabase
      .from("work_items")
      .select("id, site_id, code, name")
      .eq("tenant_id", tenant.id)
      .order("name"),
  ]);
  const { siteId, from, to } = readFilters(
    await searchParams,
    (sites ?? []).map((s) => s.id),
  );
  const siteName = new Map(sites?.map((s) => [s.id, s.name]));
  const itemName = new Map(items?.map((i) => [i.id, i.name]));

  // Toplamlar dönemin tüm giderlerinden (sayfa sayfa okunur); listede son LIMIT gider gösterilir
  const allRows = await fetchAll((a, b) => {
    let q = supabase
      .from("expenses")
      .select(
        "id, site_id, work_item_id, expense_date, category, amount, vat_rate, supplier, description",
      )
      .eq("tenant_id", tenant.id)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b);
    if (siteId) q = q.eq("site_id", siteId);
    return q;
  });
  const rows = allRows.slice(0, LIMIT);

  const { net, vat } = expenseTotals(allRows);
  // Kiralık ve taşeron araçlar: araç ve güzergâh ücretlerinden otomatik (Taşeron hakedişi ile aynı hesap)
  const pay = await loadContractorPayments(
    supabase,
    tenant.id,
    siteId,
    from,
    to,
  );
  const grandNet = toTL(toKurus(net) + toKurus(pay.total));
  const byCategory = new Map<string, number>(); // kuruş
  rows.forEach((r) =>
    byCategory.set(
      r.category,
      (byCategory.get(r.category) ?? 0) + toKurus(Number(r.amount)),
    ),
  );

  const activeSites = (sites ?? []).filter((s) => s.status === "active");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Giderler</h1>

      {activeSites.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Yeni gider</h2>
          <div>
            <ExpenseForm
              sites={activeSites.map((s) => ({ value: s.id, label: s.name }))}
              items={(items ?? [])
                .filter((i) => activeSites.some((s) => s.id === i.site_id))
                .map((i) => ({
                  value: i.id,
                  label: `${i.code ? `${i.code} · ` : ""}${i.name}`,
                  group: siteName.get(i.site_id),
                }))}
              defaultSiteId={
                siteId || (activeSites.length === 1 ? activeSites[0].id : "")
              }
              today={isoDateTR()}
              requestId={randomUUID()}
            />
          </div>
        </section>
      )}

      <FilterBar sites={sites ?? []} siteId={siteId} from={from} to={to} />

      <section className="card space-y-3">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Girilen giderler (KDV hariç)</dt>
          <dd className="text-right tabular-nums">{formatTL(net)}</dd>
          <dt className="text-muted">Araç kirası / taşeron (otomatik)</dt>
          <dd className="text-right tabular-nums">{formatTL(pay.total)}</dd>
          <dt className="font-semibold">Toplam gider (KDV hariç)</dt>
          <dd className="text-right text-lg font-bold tabular-nums">
            {formatTL(grandNet)}
          </dd>
          <dt className="text-muted">Girilen giderlerin KDV&apos;si</dt>
          <dd className="text-right tabular-nums">{formatTL(vat)}</dd>
          <dt className="text-muted">Girilen giderler (KDV dahil)</dt>
          <dd className="text-right tabular-nums">
            {formatTL(toTL(toKurus(net) + toKurus(vat)))}
          </dd>
        </dl>
        {rows.length > 0 && (
          <ul className="space-y-1 border-t border-line pt-2 text-sm">
            {[...byCategory].map(([c, a]) => (
              <li key={c} className="flex justify-between gap-3">
                <span className="text-muted">{categoryLabel(c)}</span>
                <span className="tabular-nums">{formatTL(toTL(a))}</span>
              </li>
            ))}
          </ul>
        )}
        {allRows.length > LIMIT && (
          <p className="text-xs text-amber-700">
            Toplamlar {allRows.length} giderin tamamından; aşağıda son {LIMIT}{" "}
            gider listeleniyor.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold">
            <Truck className="size-5 text-brand" aria-hidden /> Araç kirası ve
            taşeron
          </h2>
          <Link
            href={`/hakedis?${new URLSearchParams({ santiye: siteId, bas: from, bit: to })}`}
            className="link text-sm"
          >
            Ayrıntı
          </Link>
        </div>
        {pay.contractors.length === 0 ? (
          <p className="card text-sm text-muted">
            Bu dönemde kiralık veya taşeron araç maliyeti yok. Araçlar ekranında
            aracı &quot;Kiralık&quot; ya da &quot;Taşeron&quot; yapıp günlük
            kira, saatlik ücret veya güzergâhta sefer ücreti girin; seferler
            girildikçe burada kendiliğinden hesaplanır.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {pay.contractors.map((c) => (
              <li key={c.name} className="px-4 py-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{c.name}</span>
                  <span className="font-semibold tabular-nums">
                    {formatTL(c.total)}
                  </span>
                </div>
                <p className="text-muted">
                  {c.lines
                    .map(
                      (l) =>
                        `${l.plate}: ${formatTrNumber(l.quantity, 2)} ${l.unit}`,
                    )
                    .join(" · ")}
                  {c.missingPrice && (
                    <span className="text-red-700 dark:text-red-400">
                      {" "}
                      · bazı ücretler girilmemiş
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Bu tutarlar hesaplanır; kira faturasını ayrıca gider olarak girerseniz
          iki kez sayılır.
        </p>
      </section>

      <h2 className="font-bold">Girilen giderler</h2>
      {rows.length === 0 ? (
        <p className="card text-sm text-muted">
          Bu aralıkta girilmiş gider yok.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p>
                    <span className="text-muted">
                      {formatDateTR(r.expense_date)}
                    </span>{" "}
                    <span className="font-semibold tabular-nums">
                      {formatTL(r.amount)}
                    </span>{" "}
                    {categoryLabel(r.category)}
                    <span className="text-muted">
                      {" "}
                      · KDV %{Number(r.vat_rate)}
                    </span>
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
                  <RecordEdit
                    action={updateExpense}
                    id={r.id}
                    fields={[
                      {
                        name: "amount",
                        label: "Tutar (TL)",
                        value: r.amount,
                        number: true,
                      },
                      { name: "supplier", label: "Firma", value: r.supplier },
                      {
                        name: "description",
                        label: "Açıklama",
                        value: r.description,
                      },
                    ]}
                  />
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
