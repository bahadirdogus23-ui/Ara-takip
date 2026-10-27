// Sahadaki beyanların tutarlılık denetimleri. Saf fonksiyonlar: ekranlar, rapor ve
// WhatsApp özeti aynı kuralı kullanır.

import type { VehicleKind } from "@/lib/database.types";

// Yakıt normunun ne kadar aşılınca uyarı verileceği (%20 tolerans)
export const FUEL_TOLERANCE = 1.2;

export type FuelCheck = { lph: number | null; over: boolean };

// Makinenin saatlik tüketimi ve normu aşıp aşmadığı
export function fuelCheck(
  hours: number | null,
  liters: number | null,
  normLph: number | null,
): FuelCheck {
  if (!hours || !liters) return { lph: null, over: false };
  const lph = Math.round((liters / hours) * 10) / 10;
  return { lph, over: !!normLph && lph > normLph * FUEL_TOLERANCE };
}

// Bir kamyonun bir günde çalışabileceği süre (dakika). 11 saatlik vardiya varsayımı;
// fazla mesai yapan şantiyeler için ileride şantiye ayarı olabilir.
export const WORKDAY_MINUTES = 11 * 60;

// Mesafeden çevrim süresi tahmini: yüklü/boş ortalama 30 km/sa + 15 dk yükleme-boşaltma
const AVG_SPEED_KMH = 30;
const LOAD_UNLOAD_MIN = 15;

export type RouteLimit = {
  cycleMinutes: number;
  estimated: boolean;
  maxTrips: number;
} | null;

// Güzergâhta bir kamyonun bir günde yapabileceği en fazla sefer
export function routeLimit(route: {
  cycle_minutes: number | null;
  distance_km: number | null;
}): RouteLimit {
  let cycle = route.cycle_minutes;
  let estimated = false;
  if (!cycle && route.distance_km) {
    cycle = Math.round(
      ((Number(route.distance_km) * 2) / AVG_SPEED_KMH) * 60 + LOAD_UNLOAD_MIN,
    );
    estimated = true;
  }
  if (!cycle) return null;
  return {
    cycleMinutes: cycle,
    estimated,
    maxTrips: Math.max(1, Math.floor(WORKDAY_MINUTES / cycle)),
  };
}

export type SuspiciousTrip = {
  vehicleId: string;
  routeId: string;
  trips: number;
  maxTrips: number;
  estimated: boolean;
};

// Aynı gün, aynı araç ve güzergâh için girilen seferler fiziksel sınırı aşıyor mu?
export function suspiciousTrips(
  trips: { vehicle_id: string; route_id: string | null; trip_count: number }[],
  routes: {
    id: string;
    cycle_minutes: number | null;
    distance_km: number | null;
  }[],
): SuspiciousTrip[] {
  const totals = new Map<string, number>();
  for (const t of trips) {
    if (!t.route_id) continue;
    const key = `${t.vehicle_id}|${t.route_id}`;
    totals.set(key, (totals.get(key) ?? 0) + t.trip_count);
  }
  const out: SuspiciousTrip[] = [];
  for (const [key, count] of totals) {
    const [vehicleId, routeId] = key.split("|");
    const route = routes.find((r) => r.id === routeId);
    const limit = route && routeLimit(route);
    if (limit && count > limit.maxTrips) {
      out.push({
        vehicleId,
        routeId,
        trips: count,
        maxTrips: limit.maxTrips,
        estimated: limit.estimated,
      });
    }
  }
  return out;
}

// Araç türü yazısından kamyon / iş makinesi tahmini. Yalnızca yeni araç eklenirken
// varsayılanı seçmek için; asıl ayrım araçtaki "kind" alanıdır, kullanıcı değiştirebilir.
// Veritabanındaki ilk sınıflandırma (20261027175236 migration'ı) aynı listeyi kullanır.
const MACHINE_TYPES =
  /ekskavat|kepçe|kepce|beko|greyder|dozer|silindir|loder|loader|vinç|vinc|finişer|finiser|kırıcı|kirici|forklift|jeneratör|jenerator|jcb|kazıcı|kazici|paletli|iş makine|is makine/i;
const OTHER_TYPES = /arazöz|arazoz|sulama|pikap|binek|minibüs|minibus|servis/i;

export function guessVehicleKind(vehicleType: string): VehicleKind {
  if (MACHINE_TYPES.test(vehicleType)) return "is_makinesi";
  if (OTHER_TYPES.test(vehicleType)) return "diger";
  return "kamyon";
}

// Aynı kamyonun iki seferi arasında en az geçmesi gereken süre (dakika). Bundan kısa
// aralıkla gelen sayım çift dokunuş ya da iki puantörün aynı seferi sayması olabilir:
// güzergâhın çevrim süresinin yarısı, çevrim süresi girilmemişse 2 dakika.
export const DEFAULT_TAP_GAP_MINUTES = 2;

export function minTapGapMinutes(cycleMinutes: number | null | undefined) {
  return cycleMinutes && cycleMinutes > 0
    ? Math.max(1, cycleMinutes / 2)
    : DEFAULT_TAP_GAP_MINUTES;
}
