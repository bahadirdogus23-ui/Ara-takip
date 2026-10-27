import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Supabase Data API bir yanıtta en fazla 1000 satır döndürür ve fazlasını sessizce keser.
// Dönem verisi her zaman sıralı sorgu + sayfa sayfa okuma ile alınır.
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAll<T>(
  page: (from: number, to: number) => Page<T>,
  size = PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error("Veri alınamadı");
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

export type TripDay =
  Database["public"]["Functions"]["trip_day_summary"]["Returns"][number];
export type MachineDay =
  Database["public"]["Functions"]["machine_day_summary"]["Returns"][number];

type Filter = {
  tenantId: string;
  siteId?: string | null;
  from: string;
  to: string;
};
const args = (f: Filter) => ({
  p_tenant: f.tenantId,
  p_site: f.siteId || null,
  p_from: f.from,
  p_to: f.to,
});

// Seferler: şantiye + araç + güzergâh + gün başına bir satır (sayılar veritabanında toplanır)
export function loadTripDays(
  supabase: SupabaseClient<Database>,
  f: Filter,
): Promise<TripDay[]> {
  return fetchAll<TripDay>((a, b) =>
    supabase.rpc("trip_day_summary", args(f)).range(a, b),
  ).then((rows) =>
    rows.map((r) => ({
      ...r,
      trips: Number(r.trips),
      tonnage: Number(r.tonnage),
      untonned_trips: Number(r.untonned_trips),
    })),
  );
}

// Makine saati ve mazot: şantiye + makine + gün başına bir satır
export function loadMachineDays(
  supabase: SupabaseClient<Database>,
  f: Filter,
): Promise<MachineDay[]> {
  return fetchAll<MachineDay>((a, b) =>
    supabase.rpc("machine_day_summary", args(f)).range(a, b),
  ).then((rows) =>
    rows.map((r) => ({
      ...r,
      hours: Number(r.hours),
      fuel_liters: Number(r.fuel_liters),
      paired_hours: Number(r.paired_hours),
      paired_fuel: Number(r.paired_fuel),
    })),
  );
}
