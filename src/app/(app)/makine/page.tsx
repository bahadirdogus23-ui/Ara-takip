import { randomUUID } from "node:crypto";
import { AlertTriangle, Fuel } from "lucide-react";
import Link from "next/link";
import { DeleteButton } from "@/components/form";
import { SitePicker } from "@/components/site-picker";
import { canManage, getContext } from "@/lib/context";
import { fuelCheck } from "@/lib/field-checks";
import { formatDateTR, isoDateTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";
import { pickSite } from "@/lib/site-pref";
import { deleteMachineLog } from "./actions";
import { MachineForm } from "./machine-form";

export const metadata = { title: "Makine saati ve mazot" };

export default async function MachinePage({ searchParams }: { searchParams: Promise<{ santiye?: string; tarih?: string }> }) {
  const { santiye, tarih } = await searchParams;
  const { supabase, user, tenant } = await getContext();
  const manager = canManage(tenant.role);

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("name");
  const site = await pickSite(sites ?? [], santiye);
  if (!site) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <Fuel className="mx-auto size-10 text-brand" aria-hidden />
        <p className="mt-2 text-sm text-muted">Makine kaydı için devam eden bir şantiye olmalı.</p>
        {manager && (
          <Link href="/kurulum" className="btn-primary mt-4">
            Hızlı kurulum
          </Link>
        )}
      </div>
    );
  }

  const today = isoDateTR();
  const date = tarih && /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : today;
  const [{ data: vehicles }, { data: logs }] = await Promise.all([
    supabase.from("vehicles").select("id, plate, vehicle_type, fuel_norm_lph, active").eq("tenant_id", tenant.id).order("plate"),
    supabase
      .from("machine_logs")
      .select("id, vehicle_id, hours, fuel_liters, operator, note, created_by")
      .eq("site_id", site.id)
      .eq("log_date", date)
      .order("created_at", { ascending: false }),
  ]);
  const byId = new Map(vehicles?.map((v) => [v.id, v]));
  const active = (vehicles ?? []).filter((v) => v.active);
  const totalHours = (logs ?? []).reduce((s, l) => s + Number(l.hours ?? 0), 0);
  const totalFuel = (logs ?? []).reduce((s, l) => s + Number(l.fuel_liters ?? 0), 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Makine saati ve mazot</h1>
        <p className="text-sm text-muted">{formatDateTR(date)}</p>
      </div>
      <SitePicker sites={sites ?? []} siteId={site.id} />
      <form method="get" className="flex items-end gap-2">
        <input type="hidden" name="santiye" value={site.id} />
        <label className="flex-1 space-y-1">
          <span className="block text-sm font-medium">Tarih</span>
          <input type="date" name="tarih" defaultValue={date} max={today} className="input" />
        </label>
        <button className="btn-secondary">Göster</button>
      </form>

      <section className="card">
        {active.length ? (
          <MachineForm
            siteId={site.id}
            date={date}
            requestId={randomUUID()}
            machines={active.map((v) => ({ value: v.id, label: `${v.plate} · ${v.vehicle_type}` }))}
          />
        ) : (
          <p className="text-sm text-muted">
            Aktif araç yok.{" "}
            {manager && (
              <Link href="/araclar" className="link">
                Araç / makine ekleyin
              </Link>
            )}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">{formatDateTR(date)} kayıtları</h2>
          <p className="text-sm text-muted tabular-nums">
            {formatTrNumber(totalHours, 2)} saat · {formatTrNumber(totalFuel, 0)} L
          </p>
        </div>
        {!logs?.length ? (
          <p className="card text-sm text-muted">Kayıt yok.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {logs.map((l) => {
              const v = byId.get(l.vehicle_id);
              const fc = fuelCheck(
                l.hours === null ? null : Number(l.hours),
                l.fuel_liters === null ? null : Number(l.fuel_liters),
                v?.fuel_norm_lph ? Number(v.fuel_norm_lph) : null,
              );
              return (
                <li
                  key={l.id}
                  className={`flex items-start justify-between gap-3 px-4 py-3 ${fc.over ? "bg-red-50 dark:bg-red-950/40" : ""}`}
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold tabular-nums">{v?.plate ?? "—"}</p>
                    <p className="tabular-nums">
                      {l.hours !== null && `${formatTrNumber(Number(l.hours), 2)} saat`}
                      {l.hours !== null && l.fuel_liters !== null && " · "}
                      {l.fuel_liters !== null && `${formatTrNumber(Number(l.fuel_liters), 0)} L`}
                      {fc.lph !== null && <span className="text-muted"> · {formatTrNumber(fc.lph, 1)} L/saat</span>}
                    </p>
                    {fc.over && (
                      <p className="mt-0.5 flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
                        <AlertTriangle className="size-4" aria-hidden />
                        Norm ({formatTrNumber(Number(v!.fuel_norm_lph), 1)} L/saat) aşıldı
                      </p>
                    )}
                    <p className="text-muted">{[l.operator, l.note].filter(Boolean).join(" · ")}</p>
                  </div>
                  {(manager || l.created_by === user.id) && <DeleteButton action={deleteMachineLog} id={l.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
