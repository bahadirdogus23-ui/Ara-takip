// Sahadaki beyanların tutarlılık denetimleri. Saf fonksiyonlar: ekranlar, rapor ve
// WhatsApp özeti aynı kuralı kullanır.

// Yakıt normunun ne kadar aşılınca uyarı verileceği (%20 tolerans)
export const FUEL_TOLERANCE = 1.2;

export type FuelCheck = { lph: number | null; over: boolean };

// Makinenin saatlik tüketimi ve normu aşıp aşmadığı
export function fuelCheck(hours: number | null, liters: number | null, normLph: number | null): FuelCheck {
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

export type RouteLimit = { cycleMinutes: number; estimated: boolean; maxTrips: number } | null;

// Güzergâhta bir kamyonun bir günde yapabileceği en fazla sefer
export function routeLimit(route: { cycle_minutes: number | null; distance_km: number | null }): RouteLimit {
  let cycle = route.cycle_minutes;
  let estimated = false;
  if (!cycle && route.distance_km) {
    cycle = Math.round(((Number(route.distance_km) * 2) / AVG_SPEED_KMH) * 60 + LOAD_UNLOAD_MIN);
    estimated = true;
  }
  if (!cycle) return null;
  return { cycleMinutes: cycle, estimated, maxTrips: Math.max(1, Math.floor(WORKDAY_MINUTES / cycle)) };
}

export type SuspiciousTrip = { vehicleId: string; routeId: string; trips: number; maxTrips: number; estimated: boolean };

// Aynı gün, aynı araç ve güzergâh için girilen seferler fiziksel sınırı aşıyor mu?
export function suspiciousTrips(
  trips: { vehicle_id: string; route_id: string | null; trip_count: number }[],
  routes: { id: string; cycle_minutes: number | null; distance_km: number | null }[],
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
      out.push({ vehicleId, routeId, trips: count, maxTrips: limit.maxTrips, estimated: limit.estimated });
    }
  }
  return out;
}

// Sefer yapmayan iş makineleri (sefer sayacında listelenmez; makine saati ekranında görünür)
const MACHINE_TYPES = /ekskavat|kepçe|kepce|beko|greyder|dozer|silindir|loder|loader|vinç|vinc|finişer|finiser|kırıcı|kirici|forklift|jeneratör|jenerator/i;

export const isMachineType = (vehicleType: string) => MACHINE_TYPES.test(vehicleType);
