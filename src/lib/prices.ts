import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/summaries";

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

// Ücret geçmişi: her ücret bir geçerlilik başlangıcıyla saklanır; hesaplar kaydın
// tarihindeki ücreti kullanır (geçmiş dönemin tutarı sonradan değişmez). Güncel ücret
// tabloları (yukarıda okunanlar) geçmişin son satırından veritabanında güncellenir.
export type Dated<T> = { from: string; value: T };

// Tarihe göre artan sıralı listede o gün geçerli olan değer (yoksa null)
export function valueAt<T>(
  list: Dated<T>[] | undefined,
  date: string,
): T | null {
  let found: T | null = null;
  for (const d of list ?? []) {
    if (d.from > date) break;
    found = d.value;
  }
  return found;
}

export type VehicleRate = {
  hourly_rate: number | null;
  daily_rate: number | null;
};
export type PriceHistory = {
  route: Map<string, Dated<number | null>[]>;
  vehicle: Map<string, Dated<VehicleRate>[]>;
};

const num = (v: number | null) => (v === null ? null : Number(v));

function group<R, T>(
  rows: R[],
  key: (r: R) => string,
  item: (r: R) => Dated<T>,
) {
  const out = new Map<string, Dated<T>[]>();
  for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), item(r)]);
  return out;
}

export async function loadPriceHistory(
  supabase: Db,
  tenantId: string,
): Promise<PriceHistory> {
  const [routes, vehicles] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("route_price_history")
        .select("route_id, valid_from, trip_price")
        .eq("tenant_id", tenantId)
        .order("valid_from")
        .order("route_id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("vehicle_rate_history")
        .select("vehicle_id, valid_from, hourly_rate, daily_rate")
        .eq("tenant_id", tenantId)
        .order("valid_from")
        .order("vehicle_id")
        .range(a, b),
    ),
  ]);
  return {
    route: group(
      routes,
      (r) => r.route_id,
      (r) => ({ from: r.valid_from, value: num(r.trip_price) }),
    ),
    vehicle: group(
      vehicles,
      (r) => r.vehicle_id,
      (r) => ({
        from: r.valid_from,
        value: {
          hourly_rate: num(r.hourly_rate),
          daily_rate: num(r.daily_rate),
        },
      }),
    ),
  };
}

// Formdaki "ücret geçerlilik başlangıcı": boşsa bugün; ileri tarih kabul edilmez (null)
export function validFrom(value: string | null, today: string): string | null {
  const d = value ?? today;
  return d > today ? null : d;
}

// Hiç ücreti olmayan kaydın ilk ücreti en baştan geçerlidir (sonradan girilen eski tarihli
// seferler de ücretlensin); kilitli dönem varsa kilitten sonraki ilk günden.
export const BEGINNING = "2000-01-01";

async function firstOpenDate(
  supabase: Db,
  scope: { tenantId: string; siteId?: string },
): Promise<string> {
  let q = supabase
    .from("sites")
    .select("locked_until")
    .eq("tenant_id", scope.tenantId)
    .not("locked_until", "is", null)
    .order("locked_until", { ascending: false })
    .limit(1);
  if (scope.siteId) q = q.eq("id", scope.siteId);
  const { data } = await q.maybeSingle();
  if (!data?.locked_until) return BEGINNING;
  const d = new Date(`${data.locked_until}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Ücret o tarihte zaten bu değerse yazılmaz (ör. aracın yalnızca plakası düzeltildi):
// kilitli dönemde gereksiz yere hata vermesin, geçmiş de kalabalıklaşmasın.
function unchanged<T extends Record<string, unknown>>(
  history: (T & { valid_from: string })[],
  date: string,
  next: Partial<Record<keyof T, number | null>>,
) {
  const prev = valueAt(
    history.map((h) => ({ from: h.valid_from, value: h })),
    date,
  );
  return Object.entries(next).every(([k, v]) => {
    const p = prev?.[k];
    return (p === null || p === undefined ? null : Number(p)) === v;
  });
}

export async function saveItemPrice(
  supabase: Db,
  row: {
    work_item_id: string;
    tenant_id: string;
    site_id: string;
    unit_price: number | null;
    valid_from: string;
  },
) {
  const { data: history } = await supabase
    .from("work_item_price_history")
    .select("valid_from, unit_price")
    .eq("work_item_id", row.work_item_id)
    .order("valid_from");
  if (!history?.length) {
    if (row.unit_price === null) return { error: null };
    row = {
      ...row,
      valid_from: await firstOpenDate(supabase, {
        tenantId: row.tenant_id,
        siteId: row.site_id,
      }),
    };
  } else if (unchanged(history, row.valid_from, { unit_price: row.unit_price }))
    return { error: null };
  return supabase.from("work_item_price_history").upsert(row);
}

export async function saveRoutePrice(
  supabase: Db,
  row: {
    route_id: string;
    tenant_id: string;
    site_id: string;
    trip_price: number | null;
    valid_from: string;
  },
) {
  const { data: history } = await supabase
    .from("route_price_history")
    .select("valid_from, trip_price")
    .eq("route_id", row.route_id)
    .order("valid_from");
  if (!history?.length) {
    if (row.trip_price === null) return { error: null };
    row = {
      ...row,
      valid_from: await firstOpenDate(supabase, {
        tenantId: row.tenant_id,
        siteId: row.site_id,
      }),
    };
  } else if (unchanged(history, row.valid_from, { trip_price: row.trip_price }))
    return { error: null };
  return supabase.from("route_price_history").upsert(row);
}

export async function saveVehicleRates(
  supabase: Db,
  row: {
    vehicle_id: string;
    tenant_id: string;
    hourly_rate: number | null;
    daily_rate: number | null;
    valid_from: string;
  },
) {
  const { data: history } = await supabase
    .from("vehicle_rate_history")
    .select("valid_from, hourly_rate, daily_rate")
    .eq("vehicle_id", row.vehicle_id)
    .order("valid_from");
  if (!history?.length) {
    if (row.hourly_rate === null && row.daily_rate === null)
      return { error: null };
    row = {
      ...row,
      valid_from: await firstOpenDate(supabase, { tenantId: row.tenant_id }),
    };
  } else if (
    unchanged(history, row.valid_from, {
      hourly_rate: row.hourly_rate,
      daily_rate: row.daily_rate,
    })
  )
    return { error: null };
  return supabase.from("vehicle_rate_history").upsert(row);
}
