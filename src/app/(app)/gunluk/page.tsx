import { randomUUID } from "node:crypto";
import Link from "next/link";
import { DeleteButton } from "@/components/form";
import { canManage, getContext } from "@/lib/context";
import { formatDateTR, workDateTR } from "@/lib/format";
import { pickSite } from "@/lib/site-pref";
import { formatTrNumber } from "@/lib/number";
import { loadTripDays } from "@/lib/summaries";
import { deleteLabels, tripGroups } from "@/lib/trip-groups";
import { UNITS } from "@/lib/validation";
import { deleteProduction, deleteTrip } from "./actions";
import { ProductionForm, TripForm } from "./entry-forms";
import { SiteDatePicker } from "./site-date-picker";

export const metadata = { title: "Günlük giriş" };

const unitLabel = (u: string | undefined) =>
  u ? (UNITS[u as keyof typeof UNITS] ?? u) : "";

export default async function DailyEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string; tarih?: string }>;
}) {
  const { santiye, tarih } = await searchParams;
  const { supabase, user, tenant } = await getContext();

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, day_start_hour")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("name");

  if (!sites?.length) {
    return (
      <div className="card mx-auto max-w-lg">
        <h1 className="text-xl font-bold">Günlük giriş</h1>
        <p className="mt-2 text-sm text-muted">
          Kayıt girebilmek için devam eden bir şantiye olmalı.
        </p>
        {canManage(tenant.role) && (
          <Link href="/kurulum" className="btn-primary mt-4">
            Hızlı kurulum
          </Link>
        )}
      </div>
    );
  }

  const site = (await pickSite(sites, santiye))!;
  const today = workDateTR(new Date(), site.day_start_hour);
  const date = tarih && /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : today;

  const [
    { data: items },
    { data: vehicles },
    { data: routes },
    { data: production },
    tripDays,
  ] = await Promise.all([
    supabase
      .from("work_items")
      .select("id, code, name, unit")
      .eq("site_id", site.id)
      .order("code", { nullsFirst: false })
      .order("name"),
    supabase
      .from("vehicles")
      .select("id, plate, vehicle_type, active")
      .eq("tenant_id", tenant.id)
      .order("plate"),
    supabase
      .from("routes")
      .select("id, name, work_item_id")
      .eq("site_id", site.id)
      .order("name"),
    supabase
      .from("production_entries")
      .select("id, work_item_id, quantity, note, created_by")
      .eq("site_id", site.id)
      .eq("entry_date", date)
      .order("created_at", { ascending: false }),
    loadTripDays(supabase, {
      tenantId: tenant.id,
      siteId: site.id,
      from: date,
      to: date,
    }),
  ]);

  const itemById = new Map(items?.map((i) => [i.id, i]));
  const vehicleById = new Map(vehicles?.map((v) => [v.id, v]));
  const routeById = new Map(routes?.map((r) => [r.id, r]));
  const manager = canManage(tenant.role);
  const canDelete = (createdBy: string) => manager || createdBy === user.id;
  // Pasif araçlar formda çıkmaz ama eski kayıtlarda plakası görünür
  const activeVehicles = vehicles?.filter((v) => v.active) ?? [];
  const groups = tripGroups(tripDays, manager);
  // Güzergâha bağlı sefer/ton kalemlerinin miktarı seferlerden gelir: elle girilmez (çift sayım)
  const linked = new Set(routes?.flatMap((r) => r.work_item_id ?? []));
  const isAuto = (i: { id: string; unit: string }) =>
    linked.has(i.id) && (i.unit === "sefer" || i.unit === "ton");
  const manualItems = items?.filter((i) => !isAuto(i)) ?? [];
  const autoItems = items?.filter(isAuto) ?? [];
  const totalTrips = groups.reduce((s, g) => s + g.trips, 0);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Günlük giriş</h1>
      <SiteDatePicker sites={sites} siteId={site.id} date={date} />
      {date > today && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Dikkat: ileri bir tarihe kayıt giriyorsunuz.
        </p>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">İmalat</h2>
        {manualItems.length ? (
          <ProductionForm
            siteId={site.id}
            date={date}
            requestId={randomUUID()}
            items={manualItems.map((i) => ({
              value: i.id,
              label: `${i.code ? `${i.code} · ` : ""}${i.name} (${unitLabel(i.unit)})`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted">
            {autoItems.length
              ? "Elle girilecek iş kalemi yok."
              : "Bu şantiyede iş kalemi yok."}{" "}
            {manager && (
              <Link href={`/santiyeler/${site.id}`} className="link">
                İş kalemi ekleyin
              </Link>
            )}
          </p>
        )}
        {autoItems.length > 0 && (
          <p className="text-xs text-muted">
            Seferlerden otomatik hesaplananlar (elle girilmez):{" "}
            {autoItems.map((i) => i.name).join(", ")}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Sefer</h2>
        {activeVehicles.length ? (
          <TripForm
            siteId={site.id}
            date={date}
            requestId={randomUUID()}
            vehicles={activeVehicles.map((v) => ({
              value: v.id,
              label: `${v.plate} · ${v.vehicle_type}`,
            }))}
            routes={(routes ?? []).map((r) => ({ value: r.id, label: r.name }))}
          />
        ) : (
          <p className="text-sm text-muted">
            Aktif araç yok.{" "}
            {manager && (
              <Link href="/araclar" className="link">
                Araç ekleyin
              </Link>
            )}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{formatDateTR(date)} kayıtları</h2>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <p className="border-b border-line bg-bg px-4 py-2 text-sm font-semibold">
            İmalat ({production?.length ?? 0})
          </p>
          {production?.length ? (
            <ul className="divide-y divide-line">
              {production.map((p) => {
                const item = itemById.get(p.work_item_id);
                return (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 text-sm">
                      <p>
                        <span className="font-semibold tabular-nums">
                          {formatTrNumber(p.quantity)} {unitLabel(item?.unit)}
                        </span>{" "}
                        {item?.name ?? "—"}
                      </p>
                      {p.note && <p className="text-muted">{p.note}</p>}
                    </div>
                    {canDelete(p.created_by) && (
                      <DeleteButton action={deleteProduction} id={p.id} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">Kayıt yok.</p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <p className="border-b border-line bg-bg px-4 py-2 text-sm font-semibold">
            Sefer ({totalTrips} sefer)
          </p>
          {groups.length ? (
            <ul className="divide-y divide-line">
              {groups.map((g) => (
                <li
                  key={g.key}
                  className="flex items-start justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0 text-sm">
                    <p>
                      <span className="font-semibold tabular-nums">
                        {g.trips} sefer
                      </span>{" "}
                      {vehicleById.get(g.vehicleId)?.plate ?? "—"}
                      {g.ton > 0 && ` · ${formatTrNumber(g.ton)} t kantar`}
                    </p>
                    <p className="text-muted">
                      {[
                        g.routeId
                          ? routeById.get(g.routeId)?.name
                          : "Güzergâhsız",
                        ...g.notes,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {g.lastDeletableId && (
                    <DeleteButton
                      action={deleteTrip}
                      id={g.lastDeletableId}
                      {...deleteLabels(g.lastCount)}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">Kayıt yok.</p>
          )}
        </div>
      </section>
    </div>
  );
}
