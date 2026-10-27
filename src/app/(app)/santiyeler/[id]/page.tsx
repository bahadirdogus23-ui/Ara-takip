import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";
import { isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { formatDateTR, formatTL, isoDateTR } from "@/lib/format";
import { routeLimit } from "@/lib/field-checks";
import { formatTrNumber } from "@/lib/number";
import { loadPrices } from "@/lib/prices";
import { UNITS } from "@/lib/validation";
import { SiteForm } from "../site-form";
import { deleteRoute, deleteWorkItem } from "./actions";
import { RouteForm, WorkItemForm } from "./definition-forms";
import { LockForm } from "./lock-form";

const unitLabel = (u: string) => UNITS[u as keyof typeof UNITS] ?? u;

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kaydedildi?: string }>;
}) {
  const [{ id }, { kaydedildi }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const { supabase, tenant } = await getContext();

  // Başka firmanın şantiyesi RLS nedeniyle hiç dönmez → 404
  const [{ data: site }, { data: items }, { data: routes }] = await Promise.all(
    [
      supabase
        .from("sites")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
      supabase
        .from("work_items")
        .select("*")
        .eq("site_id", id)
        .order("code", { nullsFirst: false })
        .order("name"),
      supabase.from("routes").select("*").eq("site_id", id).order("name"),
    ],
  );
  if (!site) notFound();
  const manager = canManage(tenant.role);
  // Fiyatlar yalnızca sahibi/yöneticiye (saha personeli için veritabanı boş döner)
  const prices = manager ? await loadPrices(supabase, tenant.id) : null;
  const itemsP = (items ?? []).map((i) => ({
    ...i,
    unit_price: prices?.item.get(i.id) ?? null,
  }));
  const routesP = (routes ?? []).map((r) => ({
    ...r,
    trip_price: prices?.route.get(r.id) ?? null,
  }));
  // Seferlerin imalat sayılabileceği kalemler: birimi sefer ya da ton olanlar
  const tripItems = (items ?? [])
    .filter((i) => i.unit === "sefer" || i.unit === "ton")
    .map((i) => ({ value: i.id, label: `${i.name} (${unitLabel(i.unit)})` }));
  const itemName = new Map(items?.map((i) => [i.id, i.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/santiyeler" className="link text-sm">
          ← Şantiyeler
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <p className="text-sm text-muted">
              {[site.code, site.employer, site.location]
                .filter(Boolean)
                .join(" · ") || "—"}{" "}
              · {formatDateTR(site.start_date)} – {formatDateTR(site.end_date)}
            </p>
          </div>
          <StatusBadge status={site.status} />
        </div>
        {kaydedildi && (
          <p
            role="status"
            className="rounded-md bg-green-50 p-3 text-sm text-green-800"
          >
            Kaydedildi.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/gunluk?santiye=${site.id}`} className="btn-primary">
            Günlük giriş
          </Link>
          <Link href={`/kayitlar?santiye=${site.id}`} className="btn-secondary">
            Kayıtlar
          </Link>
        </div>
      </div>

      {manager && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Şantiye bilgilerini düzenle
          </summary>
          <div className="mt-4">
            <SiteForm site={site} />
          </div>
        </details>
      )}

      {manager && (
        <LockForm
          siteId={site.id}
          lockedUntil={site.locked_until}
          owner={tenant.role === "owner"}
          today={isoDateTR()}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">İş kalemleri</h2>
        {itemsP.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {itemsP.map((wi) => (
              <li key={wi.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {wi.code && (
                        <span className="mr-2 text-muted">{wi.code}</span>
                      )}
                      {wi.name}
                    </p>
                    <p className="text-sm text-muted">
                      {/* Fiyat yalnızca sahibi/yöneticiye gösterilir */}
                      {manager
                        ? wi.unit_price === null
                          ? "Birim fiyat yok"
                          : `${formatTL(wi.unit_price)} / ${unitLabel(wi.unit)}`
                        : `Birim: ${unitLabel(wi.unit)}`}
                      {wi.planned_quantity !== null &&
                        ` · Plan: ${formatTrNumber(wi.planned_quantity)} ${unitLabel(wi.unit)}`}
                    </p>
                  </div>
                  {manager && (
                    <DeleteButton
                      action={deleteWorkItem}
                      id={wi.id}
                      confirmText={`"${wi.name}" silinsin mi? Bu kaleme imalat girilmişse silinemez.`}
                    />
                  )}
                </div>
                {manager && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-brand-strong">
                      Düzenle
                    </summary>
                    <div className="mt-3">
                      <WorkItemForm siteId={site.id} item={wi} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-muted">
            Henüz iş kalemi yok. İmalat girebilmek için en az bir iş kalemi (ör.
            &quot;Kazı, m³&quot;) tanımlayın.
          </p>
        )}
        {manager && (
          <div className="card">
            <h3 className="mb-3 font-semibold">Yeni iş kalemi</h3>
            <WorkItemForm siteId={site.id} />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Güzergâhlar</h2>
        {routesP.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {routesP.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-muted">
                      {[r.origin, r.destination].filter(Boolean).join(" → ") ||
                        "—"}
                      {r.distance_km !== null &&
                        ` · ${formatTrNumber(r.distance_km, 2)} km`}
                      {manager &&
                        r.trip_price !== null &&
                        ` · ${formatTL(r.trip_price)}/sefer`}
                      {r.work_item_id &&
                        ` · seferler → ${itemName.get(r.work_item_id) ?? "iş kalemi"}`}
                      {(() => {
                        const limit = routeLimit(r);
                        return (
                          limit &&
                          ` · ${limit.estimated ? "tahmini " : ""}en fazla ${limit.maxTrips} sefer/gün`
                        );
                      })()}
                    </p>
                  </div>
                  {manager && (
                    <DeleteButton
                      action={deleteRoute}
                      id={r.id}
                      confirmText={`"${r.name}" silinsin mi?`}
                    />
                  )}
                </div>
                {manager && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-brand-strong">
                      Düzenle
                    </summary>
                    <div className="mt-3">
                      <RouteForm siteId={site.id} route={r} items={tripItems} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-muted">
            Henüz güzergâh yok. Sefer girerken güzergâh seçmek isteğe bağlıdır.
          </p>
        )}
        {manager && (
          <div className="card">
            <h3 className="mb-3 font-semibold">Yeni güzergâh</h3>
            <RouteForm siteId={site.id} items={tripItems} />
          </div>
        )}
      </section>
    </div>
  );
}
