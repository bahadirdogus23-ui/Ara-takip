import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { routeLimit } from "@/lib/field-checks";
import { toKurus, toTL } from "@/lib/money";
import {
  loadPrices,
  loadPriceHistory,
  valueAt,
  type PriceHistory,
  type VehicleRate,
} from "@/lib/prices";
import { loadMachineDays, loadTripDays } from "@/lib/summaries";

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
export type PayRoute = {
  id: string;
  name: string;
  trip_price: number | null;
  cycle_minutes: number | null;
  distance_km: number | null;
};
export type PayTrip = {
  vehicle_id: string;
  route_id: string | null;
  entry_date: string;
  trip_count: number;
};
export type PayMachineLog = {
  vehicle_id: string;
  hours: number | null;
  log_date?: string;
};

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
  suspiciousDays: {
    plate: string;
    date: string;
    route: string;
    trips: number;
    maxTrips: number;
  }[];
};

// Tarihi bilinmeyen makine kaydı (eski çağrılar) en son ücretle hesaplanır
const LATEST = "9999-12-31";

export function computeContractorPayments(input: {
  vehicles: PayVehicle[];
  routes: PayRoute[];
  trips: PayTrip[];
  machineLogs: PayMachineLog[];
  // Ücret geçmişi verilirse her gün o günkü ücret kullanılır; verilmezse araç ve
  // güzergâhtaki tek ücret (testler ve eski çağrılar)
  history?: PriceHistory;
}): { contractors: ContractorPay[]; total: number } {
  const routeById = new Map(input.routes.map((r) => [r.id, r]));
  const h = input.history;
  const routePrice = (routeId: string, date: string): number | null => {
    if (h) return valueAt(h.route.get(routeId), date);
    const p = routeById.get(routeId)?.trip_price;
    return p === null || p === undefined ? null : Number(p);
  };
  const vehicleRate = (v: PayVehicle, date: string): VehicleRate =>
    h
      ? (valueAt(h.vehicle.get(v.id), date) ?? {
          hourly_rate: null,
          daily_rate: null,
        })
      : {
          hourly_rate: v.hourly_rate === null ? null : Number(v.hourly_rate),
          daily_rate:
            v.daily_rate === null || v.daily_rate === undefined
              ? null
              : Number(v.daily_rate),
        };
  const payable = input.vehicles.filter((v) => v.ownership !== "own");
  const groups = new Map<string, ContractorPay & { totalK: number }>();

  const group = (v: PayVehicle) => {
    const name =
      v.contractor_name?.trim() || `${v.plate} (taşeron adı girilmemiş)`;
    let g = groups.get(name);
    if (!g) {
      g = {
        name,
        lines: [],
        total: 0,
        totalK: 0,
        missingPrice: false,
        suspiciousDays: [],
      };
      groups.set(name, g);
    }
    return g;
  };

  for (const v of payable) {
    const trips = input.trips.filter((t) => t.vehicle_id === v.id);
    const logs = input.machineLogs.filter((l) => l.vehicle_id === v.id);
    if (!trips.length && !logs.length) continue;
    const g = group(v);

    // Her gün o günkü ücretle hesaplanır (ücret geçmişi). Günlük kirası olan günde sefer ve
    // saat ücreti ayrıca ödenmez; aracın sefer ya da makine kaydı olan her gün bir gün sayılır.
    const routeTrips = new Map<
      string,
      { route: string; price: number | null; qty: number }
    >();
    const dailyDays = new Map<number, Set<string>>();
    const hourly = new Map<string, { rate: number | null; hours: number }>();
    for (const t of trips) {
      const rate = vehicleRate(v, t.entry_date);
      if (rate.daily_rate !== null) {
        dailyDays.set(
          rate.daily_rate,
          (dailyDays.get(rate.daily_rate) ?? new Set()).add(t.entry_date),
        );
        continue;
      }
      const routeId = t.route_id ?? "";
      const price = routePrice(routeId, t.entry_date);
      const key = `${routeId}|${price}`;
      const line = routeTrips.get(key) ?? { route: routeId, price, qty: 0 };
      line.qty += t.trip_count;
      routeTrips.set(key, line);
    }
    for (const l of logs) {
      const rate = vehicleRate(v, l.log_date ?? LATEST);
      if (rate.daily_rate !== null) {
        if (l.log_date)
          dailyDays.set(
            rate.daily_rate,
            (dailyDays.get(rate.daily_rate) ?? new Set()).add(l.log_date),
          );
        continue;
      }
      const key = String(rate.hourly_rate);
      const h = hourly.get(key) ?? { rate: rate.hourly_rate, hours: 0 };
      h.hours += Number(l.hours ?? 0);
      hourly.set(key, h);
    }

    for (const { route: routeId, price, qty } of routeTrips.values()) {
      const route = routeById.get(routeId);
      const amountK = price === null ? 0 : qty * toKurus(price);
      if (price === null) g.missingPrice = true;
      g.lines.push({
        plate: v.plate,
        description: route?.name ?? "Güzergâh seçilmemiş",
        unit: "sefer",
        quantity: qty,
        unitPrice: price,
        amount: toTL(amountK),
      });
      g.totalK += amountK;
    }

    for (const [dailyRate, days] of dailyDays) {
      const amountK = days.size * toKurus(dailyRate);
      g.lines.push({
        plate: v.plate,
        description: "Günlük kira",
        unit: "gün",
        quantity: days.size,
        unitPrice: dailyRate,
        amount: toTL(amountK),
      });
      g.totalK += amountK;
    }

    for (const { rate, hours } of hourly.values()) {
      if (!hours) continue;
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
      if (limit && n > limit.maxTrips)
        g.suspiciousDays.push({
          plate: v.plate,
          date,
          route: route.name,
          trips: n,
          maxTrips: limit.maxTrips,
        });
    }
  }

  const contractors = [...groups.values()]
    .map(({ totalK, ...g }) => ({
      ...g,
      total: toTL(totalK),
      suspiciousDays: g.suspiciousDays.sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return {
    contractors,
    total: toTL(contractors.reduce((s, c) => s + toKurus(c.total), 0)),
  };
}

// Hakediş verisini kullanıcının oturumuyla çeker (RLS geçerli). siteId boşsa tüm şantiyeler.
// Seferler ve makine kayıtları veritabanında gün bazında toplanıp sayfa sayfa okunur
// (Supabase'in 1000 satır sınırı hakedişi eksik çıkarmasın).
export async function loadContractorPayments(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  siteId: string,
  from: string,
  to: string,
) {
  const filter = { tenantId, siteId, from, to };
  const [v, r, prices, history, tripDays, machineDays] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, plate, vehicle_type, ownership, contractor_name")
      .eq("tenant_id", tenantId),
    supabase
      .from("routes")
      .select("id, name, cycle_minutes, distance_km")
      .eq("tenant_id", tenantId),
    loadPrices(supabase, tenantId),
    loadPriceHistory(supabase, tenantId),
    loadTripDays(supabase, filter),
    loadMachineDays(supabase, filter),
  ]);
  if (v.error || r.error) throw new Error("Hakediş verisi alınamadı");
  return computeContractorPayments({
    vehicles: v.data.map((x) => ({
      ...x,
      hourly_rate: prices.vehicle.get(x.id)?.hourly_rate ?? null,
      daily_rate: prices.vehicle.get(x.id)?.daily_rate ?? null,
    })),
    routes: r.data.map((x) => ({
      ...x,
      trip_price: prices.route.get(x.id) ?? null,
    })),
    trips: tripDays.map((t) => ({
      vehicle_id: t.vehicle_id,
      route_id: t.route_id,
      entry_date: t.entry_date,
      trip_count: t.trips,
    })),
    machineLogs: machineDays.map((m) => ({
      vehicle_id: m.vehicle_id,
      hours: m.hours,
      log_date: m.log_date,
    })),
    history,
  });
}
