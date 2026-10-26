import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { routeLimit } from "@/lib/field-checks";
import { toKurus, toTL } from "@/lib/money";

// Taşeron / kiralık araç hakedişi: dönemdeki seferler × güzergâh sefer ücreti,
// iş makinesi saatleri × saatlik ücret. Öz mal araçlar dahil edilmez.
// Para hesabı kuruş ile yapılır.

export type PayVehicle = {
  id: string;
  plate: string;
  vehicle_type: string;
  ownership: string;
  contractor_name: string | null;
  hourly_rate: number | null;
  daily_rate?: number | null;
};
export type PayRoute = { id: string; name: string; trip_price: number | null; cycle_minutes: number | null; distance_km: number | null };
export type PayTrip = { vehicle_id: string; route_id: string | null; entry_date: string; trip_count: number };
export type PayMachineLog = { vehicle_id: string; hours: number | null; log_date?: string };

export type PayLine = {
  plate: string;
  description: string; // güzergâh adı ya da "Makine çalışması"
  unit: "sefer" | "saat" | "gün";
  quantity: number;
  unitPrice: number | null; // null: ücret tanımlı değil
  amount: number; // TL
};

export type ContractorPay = {
  name: string;
  lines: PayLine[];
  total: number;
  missingPrice: boolean;
  suspiciousDays: { plate: string; date: string; route: string; trips: number; maxTrips: number }[];
};

export function computeContractorPayments(input: {
  vehicles: PayVehicle[];
  routes: PayRoute[];
  trips: PayTrip[];
  machineLogs: PayMachineLog[];
}): { contractors: ContractorPay[]; total: number } {
  const routeById = new Map(input.routes.map((r) => [r.id, r]));
  const payable = input.vehicles.filter((v) => v.ownership !== "own");
  const groups = new Map<string, ContractorPay & { totalK: number }>();

  const group = (v: PayVehicle) => {
    const name = v.contractor_name?.trim() || `${v.plate} (taşeron adı girilmemiş)`;
    let g = groups.get(name);
    if (!g) {
      g = { name, lines: [], total: 0, totalK: 0, missingPrice: false, suspiciousDays: [] };
      groups.set(name, g);
    }
    return g;
  };

  for (const v of payable) {
    const trips = input.trips.filter((t) => t.vehicle_id === v.id);
    const logs = input.machineLogs.filter((l) => l.vehicle_id === v.id);
    const hours = logs.reduce((s, l) => s + Number(l.hours ?? 0), 0);
    if (!trips.length && !logs.length) continue;
    const g = group(v);

    // Güzergâh başına sefer satırı (günlük kiralık araçta sefer ücreti ödenmez, sefer sayısı bilgi amaçlı)
    const byRoute = new Map<string, number>();
    for (const t of trips) byRoute.set(t.route_id ?? "", (byRoute.get(t.route_id ?? "") ?? 0) + t.trip_count);
    for (const [routeId, qty] of byRoute) {
      if (v.daily_rate !== null && v.daily_rate !== undefined) break;
      const route = routeById.get(routeId);
      const price = route?.trip_price === null || route?.trip_price === undefined ? null : Number(route.trip_price);
      const amountK = price === null ? 0 : qty * toKurus(price);
      if (price === null) g.missingPrice = true;
      g.lines.push({ plate: v.plate, description: route?.name ?? "Güzergâh seçilmemiş", unit: "sefer", quantity: qty, unitPrice: price, amount: toTL(amountK) });
      g.totalK += amountK;
    }

    // Günlük kira: aracın sefer ya da makine kaydı olan her gün bir gün sayılır.
    // Günlük kira girilmişse saatlik/sefer ücreti yerine bu kullanılır (ikisi birden ödenmez).
    const dailyRate = v.daily_rate === null || v.daily_rate === undefined ? null : Number(v.daily_rate);
    if (dailyRate !== null) {
      const days = new Set([
        ...trips.map((t) => t.entry_date),
        ...input.machineLogs.filter((l) => l.vehicle_id === v.id && l.log_date).map((l) => l.log_date!),
      ]).size;
      const amountK = days * toKurus(dailyRate);
      g.lines.push({ plate: v.plate, description: "Günlük kira", unit: "gün", quantity: days, unitPrice: dailyRate, amount: toTL(amountK) });
      g.totalK += amountK;
    }

    if (hours && dailyRate === null) {
      const rate = v.hourly_rate === null ? null : Number(v.hourly_rate);
      // saat 2 ondalıklı: kuruş × saat, sonra kuruşa yuvarla
      const amountK = rate === null ? 0 : Math.round(toKurus(rate) * hours);
      if (rate === null) g.missingPrice = true;
      g.lines.push({
        plate: v.plate,
        description: "Makine çalışması",
        unit: "saat",
        quantity: Math.round(hours * 100) / 100,
        unitPrice: rate,
        amount: toTL(amountK),
      });
      g.totalK += amountK;
    }

    // Ödemeden önce kontrol edilmesi gereken günler: güzergâhın günlük sınırını aşan seferler
    const perDay = new Map<string, number>();
    for (const t of trips) {
      if (!t.route_id) continue;
      const key = `${t.entry_date}|${t.route_id}`;
      perDay.set(key, (perDay.get(key) ?? 0) + t.trip_count);
    }
    for (const [key, n] of perDay) {
      const [date, routeId] = key.split("|");
      const route = routeById.get(routeId);
      const limit = route && routeLimit(route);
      if (limit && n > limit.maxTrips) g.suspiciousDays.push({ plate: v.plate, date, route: route.name, trips: n, maxTrips: limit.maxTrips });
    }
  }

  const contractors = [...groups.values()]
    .map(({ totalK, ...g }) => ({
      ...g,
      total: toTL(totalK),
      suspiciousDays: g.suspiciousDays.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return { contractors, total: toTL(contractors.reduce((s, c) => s + toKurus(c.total), 0)) };
}

// Hakediş verisini kullanıcının oturumuyla çeker (RLS geçerli). siteId boşsa tüm şantiyeler.
export async function loadContractorPayments(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  siteId: string,
  from: string,
  to: string,
) {
  let trips = supabase
    .from("trip_entries")
    .select("vehicle_id, route_id, entry_date, trip_count")
    .eq("tenant_id", tenantId)
    .gte("entry_date", from)
    .lte("entry_date", to);
  let logs = supabase.from("machine_logs").select("vehicle_id, hours, log_date").eq("tenant_id", tenantId).gte("log_date", from).lte("log_date", to);
  if (siteId) {
    trips = trips.eq("site_id", siteId);
    logs = logs.eq("site_id", siteId);
  }
  const [v, r, t, m] = await Promise.all([
    supabase.from("vehicles").select("id, plate, vehicle_type, ownership, contractor_name, hourly_rate, daily_rate").eq("tenant_id", tenantId),
    supabase.from("routes").select("id, name, trip_price, cycle_minutes, distance_km").eq("tenant_id", tenantId),
    trips,
    logs,
  ]);
  if (v.error || r.error || t.error || m.error) throw new Error("Hakediş verisi alınamadı");
  return computeContractorPayments({ vehicles: v.data, routes: r.data, trips: t.data, machineLogs: m.data });
}
