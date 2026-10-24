import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toKurus, toTL } from "@/lib/money";
import { EXPENSE_CATEGORIES, UNITS } from "@/lib/validation";

// Dönem raporu: bir şantiyenin seçilen tarih aralığındaki imalatı, giderleri ve seferleri.
// Tutar, gerçekleşme ve birim maliyet veritabanında hesaplanır (production_summary,
// expense_summary); burada yalnızca toplanır ve gösterime hazırlanır.
//
// Bu rapor resmî hakediş değildir: fiyat farkı, kesintiler ve vergiler hesaba katılmaz.

export type ReportItem = {
  code: string | null;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  plannedQuantity: number | null;
  progressPercent: number | null;
  directCost: number;
  unitCost: number | null;
};

export type ReportExpense = { category: string; label: string; amount: number; vat: number; total: number; count: number };

export type ReportTrip = { plate: string; vehicleType: string; trips: number; tonnage: number };

export type Report = {
  site: { id: string; name: string; code: string | null; employer: string | null };
  tenantName: string;
  from: string;
  to: string;
  items: ReportItem[];
  expenses: ReportExpense[];
  trips: ReportTrip[];
  totals: {
    amount: number; // Σ imalat tutarı (KDV hariç)
    expenseNet: number; // Σ gider (KDV hariç)
    expenseVat: number;
    directCost: number; // iş kalemine bağlanmış gider
    generalExpense: number; // iş kalemine bağlanmamış gider
    difference: number; // imalat tutarı − gider (KDV hariç)
    trips: number;
    tonnage: number;
  };
};

type ProductionRow = Database["public"]["Functions"]["production_summary"]["Returns"][number];
type ExpenseRow = Database["public"]["Functions"]["expense_summary"]["Returns"][number];
type TripRow = { vehicle_id: string; trip_count: number; tonnage: number | null };
type VehicleRow = { id: string; plate: string; vehicle_type: string };

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const unitLabel = (u: string) => UNITS[u as keyof typeof UNITS] ?? u;
const categoryLabel = (c: string) => EXPENSE_CATEGORIES[c as keyof typeof EXPENSE_CATEGORIES] ?? c;

// Veritabanından gelen satırları rapora çevirir (saf fonksiyon, test edilebilir)
export function summarizeReport(input: {
  site: Report["site"];
  tenantName: string;
  from: string;
  to: string;
  production: ProductionRow[];
  expenses: ExpenseRow[];
  trips: TripRow[];
  vehicles: VehicleRow[];
}): Report {
  const items: ReportItem[] = input.production.map((r) => ({
    code: r.code ?? null,
    name: r.name,
    unit: r.unit,
    quantity: Number(r.quantity ?? 0),
    unitPrice: n(r.unit_price),
    amount: Number(r.amount ?? 0),
    plannedQuantity: n(r.planned_quantity),
    progressPercent: n(r.progress_percent),
    directCost: Number(r.direct_cost ?? 0),
    unitCost: n(r.unit_cost),
  }));

  const expenses: ReportExpense[] = input.expenses.map((e) => ({
    category: e.category,
    label: categoryLabel(e.category),
    amount: Number(e.amount),
    vat: Number(e.vat_amount),
    total: Number(e.total),
    count: Number(e.entry_count),
  }));

  const vehicleById = new Map(input.vehicles.map((v) => [v.id, v]));
  const byVehicle = new Map<string, ReportTrip>();
  for (const t of input.trips) {
    const v = vehicleById.get(t.vehicle_id);
    const cur = byVehicle.get(t.vehicle_id) ?? { plate: v?.plate ?? "—", vehicleType: v?.vehicle_type ?? "", trips: 0, tonnage: 0 };
    cur.trips += t.trip_count;
    cur.tonnage = Math.round((cur.tonnage + Number(t.tonnage ?? 0)) * 1000) / 1000;
    byVehicle.set(t.vehicle_id, cur);
  }
  const trips = [...byVehicle.values()].sort((a, b) => a.plate.localeCompare(b.plate, "tr"));

  // Para toplamları kuruş üzerinden
  const sumK = (xs: number[]) => xs.reduce((s, x) => s + toKurus(x), 0);
  const amountK = sumK(items.map((i) => i.amount));
  const expenseNetK = sumK(expenses.map((e) => e.amount));
  const directK = sumK(items.map((i) => i.directCost));

  return {
    site: input.site,
    tenantName: input.tenantName,
    from: input.from,
    to: input.to,
    items,
    expenses,
    trips,
    totals: {
      amount: toTL(amountK),
      expenseNet: toTL(expenseNetK),
      expenseVat: toTL(sumK(expenses.map((e) => e.vat))),
      directCost: toTL(directK),
      generalExpense: toTL(expenseNetK - directK),
      difference: toTL(amountK - expenseNetK),
      trips: trips.reduce((s, t) => s + t.trips, 0),
      tonnage: Math.round(trips.reduce((s, t) => s + t.tonnage, 0) * 1000) / 1000,
    },
  };
}

// Raporu kullanıcının kendi oturumuyla çeker: RLS sayesinde başka firmanın
// şantiyesi için null döner.
export async function loadReport(
  supabase: SupabaseClient<Database>,
  tenant: { id: string; name: string },
  siteId: string,
  from: string,
  to: string,
): Promise<Report | null> {
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, code, employer")
    .eq("id", siteId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!site) return null;

  const args = { p_site: siteId, p_from: from, p_to: to };
  const [prod, exp, trips, vehicles] = await Promise.all([
    supabase.rpc("production_summary", args),
    supabase.rpc("expense_summary", args),
    supabase.from("trip_entries").select("vehicle_id, trip_count, tonnage").eq("site_id", siteId).gte("entry_date", from).lte("entry_date", to),
    supabase.from("vehicles").select("id, plate, vehicle_type").eq("tenant_id", tenant.id),
  ]);
  const failed = [prod, exp, trips, vehicles].find((r) => r.error);
  if (failed?.error) throw new Error("Rapor verisi alınamadı");

  return summarizeReport({
    site,
    tenantName: tenant.name,
    from,
    to,
    production: prod.data ?? [],
    expenses: exp.data ?? [],
    trips: trips.data ?? [],
    vehicles: vehicles.data ?? [],
  });
}
