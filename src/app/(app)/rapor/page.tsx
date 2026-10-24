import { redirect } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { formatDateTR, formatTL } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";
import { loadReport, unitLabel } from "@/lib/report";

export const metadata = { title: "Dönem raporu" };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string; bas?: string; bit?: string }>;
}) {
  const { supabase, tenant } = await getContext();
  // Raporda giderler olduğu için saha personeline kapalı
  if (!canManage(tenant.role)) redirect("/panel");

  const { data: sites } = await supabase.from("sites").select("id, name, status").eq("tenant_id", tenant.id).order("name");
  if (!sites?.length) {
    return <p className="card text-sm text-muted">Rapor alabilmek için önce bir şantiye ekleyin.</p>;
  }

  const params = await searchParams;
  const filters = readFilters(params, sites.map((s) => s.id));
  const siteId = filters.siteId || (sites.find((s) => s.status === "active") ?? sites[0]).id;
  const { from, to } = filters;

  const report = await loadReport(supabase, tenant, siteId, from, to);
  if (!report) redirect("/rapor");
  const { items, expenses, trips, totals } = report;
  const qs = new URLSearchParams({ santiye: siteId, bas: from, bit: to }).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dönem raporu</h1>
        <div className="flex gap-2">
          <a href={`/rapor/excel?${qs}`} className="btn-secondary" download>
            Excel indir
          </a>
          <a href={`/rapor/pdf?${qs}`} className="btn-secondary" download>
            PDF indir
          </a>
        </div>
      </div>

      <FilterBar sites={sites} siteId={siteId} from={from} to={to} allowAll={false} />

      <div>
        <p className="text-lg font-semibold">{report.site.name}</p>
        <p className="text-sm text-muted">
          {[report.site.code, report.site.employer].filter(Boolean).join(" · ")}
          {(report.site.code || report.site.employer) && " · "}
          {formatDateTR(from)} – {formatDateTR(to)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="İmalat tutarı" value={formatTL(totals.amount)} hint="Sözleşme birim fiyatıyla, KDV hariç" />
        <Stat label="Gider" value={formatTL(totals.expenseNet)} hint={`KDV hariç · KDV ${formatTL(totals.expenseVat)}`} />
        <Stat
          label="Tutar − gider"
          value={formatTL(totals.difference)}
          hint="KDV hariç, kesinti ve vergiler düşülmeden"
          tone={totals.difference < 0 ? "bad" : "good"}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">İmalat</h2>
        {items.length === 0 ? (
          <p className="card text-sm text-muted">Bu şantiyede iş kalemi yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Poz / iş kalemi</th>
                  <th className="px-3 py-2 text-right">Miktar</th>
                  <th className="px-3 py-2 text-right">Birim fiyat</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                  <th className="px-3 py-2 text-right">Gerçekleşme</th>
                  <th className="px-3 py-2 text-right">Birim maliyet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      {i.code && <span className="mr-2 text-muted">{i.code}</span>}
                      {i.name}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatTrNumber(i.quantity)} {unitLabel(i.unit)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{i.unitPrice === null ? "—" : formatTL(i.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatTL(i.amount)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {i.progressPercent === null ? "—" : `%${formatTrNumber(i.progressPercent, 2)}`}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{i.unitCost === null ? "—" : formatTL(i.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    Toplam
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatTL(totals.amount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">
          Gerçekleşme = dönem miktarı ÷ planlanan miktar. Birim maliyet = iş kalemine bağlanmış gider ÷ dönem miktarı.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Giderler</h2>
          {expenses.length === 0 ? (
            <p className="card text-sm text-muted">Bu dönemde gider yok.</p>
          ) : (
            <div className="card space-y-1 text-sm">
              {expenses.map((e) => (
                <div key={e.category} className="flex justify-between gap-3">
                  <span>
                    {e.label} <span className="text-muted">({e.count})</span>
                  </span>
                  <span className="tabular-nums">{formatTL(e.amount)}</span>
                </div>
              ))}
              <div className="mt-2 space-y-1 border-t border-line pt-2">
                <Row label="İş kalemlerine bağlı" value={formatTL(totals.directCost)} />
                <Row label="Genel gider" value={formatTL(totals.generalExpense)} />
                <Row label="KDV" value={formatTL(totals.expenseVat)} />
                <Row label="KDV dahil toplam" value={formatTL(totals.expenseNet + totals.expenseVat)} strong />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">Seferler</h2>
          {trips.length === 0 ? (
            <p className="card text-sm text-muted">Bu dönemde sefer yok.</p>
          ) : (
            <div className="card space-y-1 text-sm">
              {trips.map((t) => (
                <div key={t.plate} className="flex justify-between gap-3">
                  <span>
                    {t.plate} <span className="text-muted">{t.vehicleType}</span>
                  </span>
                  <span className="tabular-nums">
                    {t.trips} sefer{t.tonnage > 0 && ` · ${formatTrNumber(t.tonnage)} t`}
                  </span>
                </div>
              ))}
              <div className="mt-2 border-t border-line pt-2">
                <Row
                  label="Toplam"
                  value={`${totals.trips} sefer${totals.tonnage > 0 ? ` · ${formatTrNumber(totals.tonnage)} t` : ""}`}
                  strong
                />
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
        Bu rapor iç takip içindir, resmî hakediş yerine geçmez. Fiyat farkı, kesintiler, teminat ve vergiler hesaba katılmaz.
      </p>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  const color = tone === "bad" ? "text-red-700 dark:text-red-400" : tone === "good" ? "text-green-700 dark:text-green-400" : "";
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
