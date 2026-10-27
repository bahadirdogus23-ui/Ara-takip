import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Fiyat ve ücretler ayrı tablolarda; veritabanı kuralları (RLS) yalnızca firma sahibi ve
// yöneticiye açar. Saha personeli için bu fonksiyonlar boş döner.
type Db = SupabaseClient<Database>;

export type Prices = {
  item: Map<string, number>; // iş kalemi → birim fiyat
  route: Map<string, number>; // güzergâh → taşeron sefer ücreti
  vehicle: Map<
    string,
    { hourly_rate: number | null; daily_rate: number | null }
  >;
};

export async function loadPrices(
  supabase: Db,
  tenantId: string,
): Promise<Prices> {
  const [i, r, v] = await Promise.all([
    supabase
      .from("work_item_prices")
      .select("work_item_id, unit_price")
      .eq("tenant_id", tenantId),
    supabase
      .from("route_prices")
      .select("route_id, trip_price")
      .eq("tenant_id", tenantId),
    supabase
      .from("vehicle_rates")
      .select("vehicle_id, hourly_rate, daily_rate")
      .eq("tenant_id", tenantId),
  ]);
  if (i.error || r.error || v.error) throw new Error("Fiyatlar alınamadı");
  return {
    item: new Map(
      i.data
        .filter((x) => x.unit_price !== null)
        .map((x) => [x.work_item_id, Number(x.unit_price)]),
    ),
    route: new Map(
      r.data
        .filter((x) => x.trip_price !== null)
        .map((x) => [x.route_id, Number(x.trip_price)]),
    ),
    vehicle: new Map(
      v.data.map((x) => [
        x.vehicle_id,
        {
          hourly_rate: x.hourly_rate === null ? null : Number(x.hourly_rate),
          daily_rate: x.daily_rate === null ? null : Number(x.daily_rate),
        },
      ]),
    ),
  };
}

// Fiyat boşsa satır silinir; doluysa yazılır ya da güncellenir
export async function saveItemPrice(
  supabase: Db,
  row: {
    work_item_id: string;
    tenant_id: string;
    site_id: string;
    unit_price: number | null;
  },
) {
  if (row.unit_price === null)
    return supabase
      .from("work_item_prices")
      .delete()
      .eq("work_item_id", row.work_item_id);
  return supabase
    .from("work_item_prices")
    .upsert({ ...row, updated_at: new Date().toISOString() });
}

export async function saveRoutePrice(
  supabase: Db,
  row: {
    route_id: string;
    tenant_id: string;
    site_id: string;
    trip_price: number | null;
  },
) {
  if (row.trip_price === null)
    return supabase.from("route_prices").delete().eq("route_id", row.route_id);
  return supabase
    .from("route_prices")
    .upsert({ ...row, updated_at: new Date().toISOString() });
}

export async function saveVehicleRates(
  supabase: Db,
  row: {
    vehicle_id: string;
    tenant_id: string;
    hourly_rate: number | null;
    daily_rate: number | null;
  },
) {
  if (row.hourly_rate === null && row.daily_rate === null)
    return supabase
      .from("vehicle_rates")
      .delete()
      .eq("vehicle_id", row.vehicle_id);
  return supabase
    .from("vehicle_rates")
    .upsert({ ...row, updated_at: new Date().toISOString() });
}
