import { AlertTriangle, HandCoins } from "lucide-react";
import { redirect } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { loadContractorPayments } from "@/lib/contractor";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { formatDateTR, formatTL } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";

export const metadata = { title: "Taşeron hakedişi" };

export default async function ContractorPayPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string; bas?: string; bit?: string }>;
}) {
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/panel");

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .order("name");
  const { siteId, from, to } = readFilters(
    await searchParams,
    (sites ?? []).map((s) => s.id),
  );
  const { contractors, total } = await loadContractorPayments(
    supabase,
    tenant.id,
    siteId,
    from,
    to,
  );
  const qs = new URLSearchParams({
    santiye: siteId,
    bas: from,
    bit: to,
  }).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Taşeron hakedişi</h1>
          <p className="text-sm text-muted">
            Kiralık ve taşeron araçlara ödenecek tutar (KDV hariç)
          </p>
        </div>
        <a href={`/hakedis/excel?${qs}`} className="btn-secondary" download>
          Excel indir
        </a>
      </div>

      <FilterBar sites={sites ?? []} siteId={siteId} from={from} to={to} />

      {contractors.length === 0 ? (
        <div className="card text-center text-sm text-muted">
          <HandCoins className="mx-auto mb-2 size-10 text-brand" aria-hidden />
          Bu dönemde taşeron veya kiralık araç kaydı yok. Araçlar ekranında
          aracın mülkiyetini &quot;Taşeron&quot; ya da &quot;Kiralık&quot;
          seçin; güzergâhlara sefer ücreti, makinelere saatlik ücret girin.
        </div>
      ) : (
        <>
          <div className="card flex items-baseline justify-between">
            <span className="text-muted">
              {formatDateTR(from)} – {formatDateTR(to)} toplam
            </span>
            <span className="text-2xl font-extrabold tabular-nums">
              {formatTL(total)}
            </span>
          </div>

          {contractors.map((c) => (
            <section key={c.name} className="card space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold">{c.name}</h2>
                <span className="text-lg font-bold tabular-nums">
                  {formatTL(c.total)}
                </span>
              </div>
              <ul className="divide-y divide-line text-sm">
                {c.lines.map((l, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">{l.plate}</p>
                      <p className="text-muted">
                        {l.description} · {formatTrNumber(l.quantity, 2)}{" "}
                        {l.unit} ×{" "}
                        {l.unitPrice === null ? (
                          <span className="font-medium text-red-700 dark:text-red-400">
                            ücret girilmemiş
                          </span>
                        ) : (
                          formatTL(l.unitPrice)
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatTL(l.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              {c.missingPrice && (
                <p className="text-xs text-red-700 dark:text-red-400">
                  Bazı satırların ücreti tanımlı değil; güzergâh sefer ücretini
                  veya aracın saatlik ücretini girin.
                </p>
              )}
              {c.suspiciousDays.length > 0 && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="size-4" aria-hidden /> Ödemeden
                    önce kontrol edin
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {c.suspiciousDays.map((d) => (
                      <li key={`${d.plate}${d.date}${d.route}`}>
                        {formatDateTR(d.date)} · {d.plate} · {d.route}:{" "}
                        {d.trips} sefer (en fazla {d.maxTrips})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
