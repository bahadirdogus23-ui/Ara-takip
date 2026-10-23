import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { DeleteButton } from "@/components/form";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { formatDateTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";
import { UNITS } from "@/lib/validation";
import { deleteProduction, deleteTrip } from "../gunluk/actions";

export const metadata = { title: "Kayıtlar" };

const LIMIT = 500;
const unitLabel = (u: string | undefined) => (u ? (UNITS[u as keyof typeof UNITS] ?? u) : "");

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string; bas?: string; bit?: string; tur?: string }>;
}) {
  const params = await searchParams;
  const kind = params.tur === "sefer" ? "sefer" : "imalat";
  const { supabase, user, tenant } = await getContext();

  const { data: sites } = await supabase.from("sites").select("id, name").eq("tenant_id", tenant.id).order("name");
  const { siteId, from, to } = readFilters(params, (sites ?? []).map((s) => s.id));
  const siteName = new Map(sites?.map((s) => [s.id, s.name]));
  const canDelete = (createdBy: string) => canManage(tenant.role) || createdBy === user.id;
  const tabHref = (tur: string) => `/kayitlar?${new URLSearchParams({ tur, santiye: siteId, bas: from, bit: to })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Kayıtlar</h1>
        <Link href={siteId ? `/gunluk?santiye=${siteId}` : "/gunluk"} className="btn-primary">
          Yeni kayıt
        </Link>
      </div>

      <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm font-medium">
        {(["imalat", "sefer"] as const).map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            aria-current={kind === t ? "page" : undefined}
            className={`flex-1 rounded-md px-3 py-2 text-center ${kind === t ? "bg-brand text-white dark:text-black" : "text-muted hover:text-fg"}`}
          >
            {t === "imalat" ? "İmalat" : "Sefer"}
          </Link>
        ))}
      </div>

      <FilterBar sites={sites ?? []} siteId={siteId} from={from} to={to} hidden={{ tur: kind }} />

      {kind === "imalat" ? (
        <ProductionList siteId={siteId} from={from} to={to} siteName={siteName} canDelete={canDelete} />
      ) : (
        <TripList siteId={siteId} from={from} to={to} siteName={siteName} canDelete={canDelete} />
      )}
    </div>
  );
}

type ListProps = {
  siteId: string;
  from: string;
  to: string;
  siteName: Map<string, string>;
  canDelete: (createdBy: string) => boolean;
};

async function ProductionList({ siteId, from, to, siteName, canDelete }: ListProps) {
  const { supabase, tenant } = await getContext();
  let q = supabase
    .from("production_entries")
    .select("id, site_id, work_item_id, entry_date, quantity, note, created_by")
    .eq("tenant_id", tenant.id)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (siteId) q = q.eq("site_id", siteId);

  const [{ data: rows }, { data: items }] = await Promise.all([
    q,
    supabase.from("work_items").select("id, code, name, unit").eq("tenant_id", tenant.id),
  ]);
  const itemById = new Map(items?.map((i) => [i.id, i]));

  // İş kalemi başına toplam miktar (her kalemin kendi birimi var, kalemler arası toplanmaz)
  const totals = new Map<string, number>();
  rows?.forEach((r) => totals.set(r.work_item_id, (totals.get(r.work_item_id) ?? 0) + Number(r.quantity)));

  if (!rows?.length) return <p className="card text-sm text-muted">Bu aralıkta imalat kaydı yok.</p>;

  return (
    <>
      <section className="card">
        <h2 className="mb-2 font-semibold">Toplamlar</h2>
        <ul className="space-y-1 text-sm">
          {[...totals].map(([itemId, qty]) => {
            const item = itemById.get(itemId);
            return (
              <li key={itemId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {!siteId && item && <span className="text-muted">{siteName.get(rows.find((r) => r.work_item_id === itemId)!.site_id)} · </span>}
                  {item?.name ?? "—"}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatTrNumber(qty)} {unitLabel(item?.unit)}
                </span>
              </li>
            );
          })}
        </ul>
        {rows.length === LIMIT && <p className="mt-2 text-xs text-amber-700">İlk {LIMIT} kayıt gösteriliyor; aralığı daraltın.</p>}
      </section>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r) => {
          const item = itemById.get(r.work_item_id);
          return (
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p>
                  <span className="text-muted">{formatDateTR(r.entry_date)}</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatTrNumber(r.quantity)} {unitLabel(item?.unit)}
                  </span>{" "}
                  {item?.name ?? "—"}
                </p>
                <p className="text-muted">{[!siteId && siteName.get(r.site_id), r.note].filter(Boolean).join(" · ")}</p>
              </div>
              {canDelete(r.created_by) && <DeleteButton action={deleteProduction} id={r.id} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

async function TripList({ siteId, from, to, siteName, canDelete }: ListProps) {
  const { supabase, tenant } = await getContext();
  let q = supabase
    .from("trip_entries")
    .select("id, site_id, vehicle_id, route_id, entry_date, trip_count, tonnage, note, created_by")
    .eq("tenant_id", tenant.id)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (siteId) q = q.eq("site_id", siteId);

  const [{ data: rows }, { data: vehicles }, { data: routes }] = await Promise.all([
    q,
    supabase.from("vehicles").select("id, plate").eq("tenant_id", tenant.id),
    supabase.from("routes").select("id, name").eq("tenant_id", tenant.id),
  ]);
  const plate = new Map(vehicles?.map((v) => [v.id, v.plate]));
  const routeName = new Map(routes?.map((r) => [r.id, r.name]));

  if (!rows?.length) return <p className="card text-sm text-muted">Bu aralıkta sefer kaydı yok.</p>;

  // Araç başına toplam sefer ve tonaj
  const byVehicle = new Map<string, { trips: number; ton: number }>();
  rows.forEach((r) => {
    const t = byVehicle.get(r.vehicle_id) ?? { trips: 0, ton: 0 };
    byVehicle.set(r.vehicle_id, { trips: t.trips + r.trip_count, ton: t.ton + Number(r.tonnage ?? 0) });
  });
  const allTrips = rows.reduce((s, r) => s + r.trip_count, 0);

  return (
    <>
      <section className="card">
        <h2 className="mb-2 font-semibold">Toplam {allTrips} sefer</h2>
        <ul className="space-y-1 text-sm">
          {[...byVehicle].map(([id, t]) => (
            <li key={id} className="flex justify-between gap-3">
              <span>{plate.get(id) ?? "—"}</span>
              <span className="font-semibold tabular-nums">
                {t.trips} sefer{t.ton > 0 && ` · ${formatTrNumber(t.ton)} ton`}
              </span>
            </li>
          ))}
        </ul>
        {rows.length === LIMIT && <p className="mt-2 text-xs text-amber-700">İlk {LIMIT} kayıt gösteriliyor; aralığı daraltın.</p>}
      </section>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p>
                <span className="text-muted">{formatDateTR(r.entry_date)}</span>{" "}
                <span className="font-semibold tabular-nums">{r.trip_count} sefer</span> {plate.get(r.vehicle_id) ?? "—"}
                {r.tonnage !== null && ` · ${formatTrNumber(r.tonnage)} ton`}
              </p>
              <p className="text-muted">
                {[!siteId && siteName.get(r.site_id), r.route_id && routeName.get(r.route_id), r.note].filter(Boolean).join(" · ")}
              </p>
            </div>
            {canDelete(r.created_by) && <DeleteButton action={deleteTrip} id={r.id} />}
          </li>
        ))}
      </ul>
    </>
  );
}
