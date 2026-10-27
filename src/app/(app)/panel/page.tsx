import {
  AlertTriangle,
  BarChart3,
  ClipboardPlus,
  Fuel,
  PartyPopper,
  Receipt,
  Rocket,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoUploader } from "@/components/photo-uploader";
import { ShareSummary } from "@/components/share-summary";
import { SitePicker } from "@/components/site-picker";
import { canManage, getContext, ROLE_LABELS } from "@/lib/context";
import { buildDailySummary } from "@/lib/daily-summary";
import { fuelCheck, suspiciousTrips } from "@/lib/field-checks";
import { formatTL, workDateTR, monthRangeTR } from "@/lib/format";
import { toKurus, toTL } from "@/lib/money";
import { formatTrNumber } from "@/lib/number";
import { loadPhotos } from "@/lib/photo-load";
import { pickSite } from "@/lib/site-pref";
import { loadMachineDays, loadTripDays } from "@/lib/summaries";
import { UNITS } from "@/lib/validation";

export const metadata = { title: "Bugün" };

const unitLabel = (u: string) => UNITS[u as keyof typeof UNITS] ?? u;
const sumAmount = (rows: { amount: number }[] | null) =>
  toTL((rows ?? []).reduce((s, r) => s + toKurus(Number(r.amount ?? 0)), 0));

function greeting(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Istanbul",
    }).format(new Date()),
  );
  return h < 11 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
}

const longDate = () =>
  new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Istanbul",
  }).format(new Date());

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{
    santiye?: string;
    hazir?: string;
    sifre?: string;
    katildi?: string;
  }>;
}) {
  const { santiye, hazir, sifre, katildi } = await searchParams;
  const { supabase, user, tenant } = await getContext();
  const manager = canManage(tenant.role);

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, day_start_hour")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("name");
  const site = await pickSite(sites ?? [], santiye);
  const passwordNotice = (sifre || katildi) && (
    <p
      role="status"
      className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
    >
      {sifre
        ? "Şifreniz değiştirildi."
        : `${tenant.name} firmasına ${ROLE_LABELS[tenant.role].toLocaleLowerCase("tr-TR")} olarak katıldınız.`}
    </p>
  );

  if (!site) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Heading />
        {passwordNotice}
        <div className="card text-center">
          <Rocket className="mx-auto size-10 text-brand" aria-hidden />
          <h2 className="mt-2 text-lg font-bold">Bir dakikada başlayın</h2>
          {tenant.role === "owner" && (
            <p className="mt-1 text-sm font-medium text-green-700 dark:text-green-400">
              Firmanız aktif, firma sahibi olarak buradasınız.
            </p>
          )}
          <p className="mt-1 text-sm text-muted">
            Şantiyenizi, yapacağınız işleri ve kamyonlarınızı tek ekrandan
            ekleyin; hemen sefer saymaya başlayın.
          </p>
          {manager ? (
            <Link href="/kurulum" className="btn-primary mt-4">
              Hızlı kurulum
            </Link>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Firma yöneticinizin şantiye eklemesi gerekiyor.
            </p>
          )}
        </div>
      </div>
    );
  }

  const today = workDateTR(new Date(), site.day_start_hour);
  const month = monthRangeTR();
  const [
    { data: todayItems },
    { data: monthItems },
    tripDays,
    { data: vehicles },
    { data: routes },
    machineLogs,
  ] = await Promise.all([
    supabase.rpc("production_summary", {
      p_site: site.id,
      p_from: today,
      p_to: today,
    }),
    supabase.rpc("production_summary", {
      p_site: site.id,
      p_from: month.from,
      p_to: month.to,
    }),
    loadTripDays(supabase, {
      tenantId: tenant.id,
      siteId: site.id,
      from: today,
      to: today,
    }),
    supabase
      .from("vehicles")
      .select("id, plate, capacity_ton, fuel_norm_lph")
      .eq("tenant_id", tenant.id),
    supabase
      .from("routes")
      .select("id, name, cycle_minutes, distance_km")
      .eq("site_id", site.id),
    loadMachineDays(supabase, {
      tenantId: tenant.id,
      siteId: site.id,
      from: today,
      to: today,
    }),
  ]);

  const vehicleById = new Map(vehicles?.map((v) => [v.id, v]));
  const byVehicle = new Map<string, number>();
  const tonsByVehicle = new Map<string, number>();
  const trips = tripDays.map((d) => ({
    vehicle_id: d.vehicle_id,
    route_id: d.route_id,
    trip_count: d.trips,
  }));
  for (const t of tripDays) {
    byVehicle.set(t.vehicle_id, (byVehicle.get(t.vehicle_id) ?? 0) + t.trips);
    // Girilen kantar tonu + tonu girilmemiş seferler için araç kapasitesine göre tahmin
    const cap = vehicleById.get(t.vehicle_id)?.capacity_ton;
    const tn = t.tonnage + (cap ? Number(cap) * t.untonned_trips : 0);
    tonsByVehicle.set(
      t.vehicle_id,
      (tonsByVehicle.get(t.vehicle_id) ?? 0) + tn,
    );
  }
  const tons = [...tonsByVehicle.values()].reduce((s, n) => s + n, 0);

  const tripTotal = [...byVehicle.values()].reduce((s, n) => s + n, 0);
  const producedToday = (todayItems ?? []).filter(
    (i) => Number(i.quantity) > 0,
  );

  // Dikkat isteyenler: fiziksel sınırı aşan sefer beyanı, normun üzerinde yakan makine
  const routeName = new Map(routes?.map((r) => [r.id, r.name]));
  const alerts = [
    ...suspiciousTrips(trips, routes ?? []).map(
      (f) =>
        `${vehicleById.get(f.vehicleId)?.plate}: ${routeName.get(f.routeId)} güzergâhında ${f.trips} sefer (en fazla ${f.maxTrips} yapılabilir)`,
    ),
    ...machineLogs.flatMap((l) => {
      const v = vehicleById.get(l.vehicle_id);
      // Aynı kayıtta saat ve mazot birlikte girilmişse L/saat hesaplanır
      const fc = fuelCheck(
        l.paired_hours || null,
        l.paired_fuel || null,
        v?.fuel_norm_lph ? Number(v.fuel_norm_lph) : null,
      );
      return fc.over
        ? [
            `${v?.plate}: ${formatTrNumber(fc.lph!, 1)} L/saat yaktı (norm ${formatTrNumber(Number(v!.fuel_norm_lph), 1)})`,
          ]
        : [];
    }),
  ];
  const machineByVehicle = new Map<string, { hours: number; fuel: number }>();
  for (const l of machineLogs) {
    const m = machineByVehicle.get(l.vehicle_id) ?? { hours: 0, fuel: 0 };
    machineByVehicle.set(l.vehicle_id, {
      hours: m.hours + Number(l.hours ?? 0),
      fuel: m.fuel + Number(l.fuel_liters ?? 0),
    });
  }
  const photos = await loadPhotos(
    supabase,
    { siteId: site.id, from: today, to: today },
    (by) => manager || by === user.id,
    12,
  );

  const summary = buildDailySummary({
    tenantName: tenant.name,
    siteName: site.name,
    date: today,
    trips: [...byVehicle]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({
        plate: vehicleById.get(id)?.plate ?? "—",
        trips: n,
        tons: tonsByVehicle.get(id) ?? 0,
      })),
    production: producedToday.map((i) => ({
      name: i.name,
      quantity: Number(i.quantity),
      unit: unitLabel(i.unit),
    })),
    machines: [...machineByVehicle].map(([id, m]) => ({
      plate: vehicleById.get(id)?.plate ?? "—",
      ...m,
    })),
    alerts,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Heading />
      <SitePicker sites={sites ?? []} siteId={site.id} />

      {passwordNotice}

      {hazir && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
        >
          <PartyPopper className="size-5 shrink-0" aria-hidden />
          Kurulum tamam. Kayıt girmeye başlayabilirsiniz.
        </p>
      )}

      {alerts.length > 0 && (
        <section className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
          <h2 className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300">
            <AlertTriangle className="size-5" aria-hidden /> Dikkat (
            {alerts.length})
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-red-900 dark:text-red-200">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bugün sefer" value={String(tripTotal)} />
        <Stat
          label="Bugün taşınan"
          value={tons ? `${formatTrNumber(tons, 0)} t` : "—"}
          hint="Kapasiteye göre tahmini"
        />
        {manager && (
          <Stat
            label="Bugün imalat"
            value={formatTL(sumAmount(todayItems))}
            hint="KDV hariç"
          />
        )}
        {manager && (
          <Stat
            label="Bu ay imalat"
            value={formatTL(sumAmount(monthItems))}
            hint="KDV hariç"
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Action
          href={`/sefer?santiye=${site.id}`}
          icon={Truck}
          label="Sefer say"
          primary
        />
        <Action
          href={`/gunluk?santiye=${site.id}`}
          icon={ClipboardPlus}
          label="İmalat gir"
        />
        <Action
          href={`/makine?santiye=${site.id}`}
          icon={Fuel}
          label="Makine / mazot"
        />
        {manager && (
          <Action href="/giderler" icon={Receipt} label="Gider ekle" />
        )}
        {manager && (
          <Action
            href={`/rapor?santiye=${site.id}`}
            icon={BarChart3}
            label="Rapor al"
          />
        )}
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">Bugünkü seferler</h2>
        {byVehicle.size === 0 ? (
          <p className="card text-sm text-muted">Henüz sefer yok.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {[...byVehicle]
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <li
                  key={id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="font-medium tabular-nums">
                    {vehicleById.get(id)?.plate ?? "—"}
                  </span>
                  <span className="font-bold tabular-nums">{n} sefer</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Bugünkü imalat</h2>
        {producedToday.length === 0 ? (
          <p className="card text-sm text-muted">Henüz imalat girilmedi.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {producedToday.map((i) => (
              <li
                key={i.work_item_id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {formatTrNumber(Number(i.quantity))} {unitLabel(i.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Bugünkü fotoğraflar</h2>
        <div className="card">
          <PhotoUploader tenantId={tenant.id} siteId={site.id} date={today} />
        </div>
        {photos.length > 0 && <PhotoGrid photos={photos} />}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Gün sonu raporu</h2>
        <p className="text-sm text-muted">
          Şantiye grubunuza tek dokunuşla gönderin. Para tutarı içermez.
        </p>
        <ShareSummary text={summary} />
      </section>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h1 className="text-2xl font-bold">{greeting()}</h1>
      <p className="text-sm capitalize text-muted">{longDate()}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Action({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${
        primary
          ? "border-brand bg-brand text-white dark:text-black"
          : "border-line bg-surface hover:border-brand"
      }`}
    >
      <Icon className="size-7" aria-hidden />
      {label}
    </Link>
  );
}
