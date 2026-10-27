import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { loadContractorPayments } from "@/lib/contractor";
import { fuelCheck } from "@/lib/field-checks";
import { toKurus, toTL } from "@/lib/money";
import { loadMachineDays, loadTripDays } from "@/lib/summaries";
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

export type ReportExpense = {
  category: string;
  label: string;
  amount: number;
  vat: number;
  total: number;
  count: number;
};

export type ReportTrip = {
  plate: string;
  vehicleType: string;
  trips: number;
  tonnage: number;
};

export type ReportMachine = {
  plate: string;
  vehicleType: string;
  hours: number;
  fuel: number;
  lph: number | null; // litre/saat (yalnızca saat ve mazotun ikisi de girilmiş kayıtlardan)
  normLph: number | null;
  over: boolean;
};

export type Report = {
  site: {
    id: string;
    name: string;
    code: string | null;
    employer: string | null;
  };
  tenantName: string;
  from: string;
  to: string;
  items: ReportItem[];
  expenses: ReportExpense[];
  trips: ReportTrip[];
  machines: ReportMachine[];
  totals: {
    amount: number; // Σ imalat tutarı (KDV hariç)
    expenseNet: number; // Σ gider (KDV hariç)
    expenseVat: number;
    directCost: number; // iş kalemine bağlanmış gider
    generalExpense: number; // iş kalemine bağlanmamış gider
    difference: number; // imalat tutarı − gider (KDV hariç)
    trips: number;
    tonnage: number;
    machineHours: number;
    fuelLiters: number;
  };
};

type ProductionRow =
  Database["public"]["Functions"]["production_summary"]["Returns"][number];
type ExpenseRow =
  Database["public"]["Functions"]["expense_summary"]["Returns"][number];
type TripRow = {
  vehicle_id: string;
  trip_count: number;
  tonnage: number | null;
};
type VehicleRow = {
  id: string;
  plate: string;
  vehicle_type: string;
  fuel_norm_lph?: number | null;
};
type MachineLogRow = {
  vehicle_id: string;
  hours: number | null;
  fuel_liters: number | null;
  paired_hours?: number;
  paired_fuel?: number;
};

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const unitLabel = (u: string) => UNITS[u as keyof typeof UNITS] ?? u;
const categoryLabel = (c: string) =>
  EXPENSE_CATEGORIES[c as keyof typeof EXPENSE_CATEGORIES] ?? c;

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
  machineLogs?: MachineLogRow[];
  // Kiralık/taşeron araçların ücretlerinden hesaplanan maliyet (taşeron hakedişi ile aynı hesap)
  vehicleCosts?: { total: number; lines: number };
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
  if (input.vehicleCosts && input.vehicleCosts.total > 0) {
    expenses.push({
      category: "vehicle_rent",
      label: "Araç kirası / taşeron (otomatik)",
      amount: input.vehicleCosts.total,
      vat: 0, // ücretler KDV hariç girilir; KDV faturaya göre değişir
      total: input.vehicleCosts.total,
      count: input.vehicleCosts.lines,
    });
  }

  const vehicleById = new Map(input.vehicles.map((v) => [v.id, v]));
  const byVehicle = new Map<string, ReportTrip>();
  for (const t of input.trips) {
    const v = vehicleById.get(t.vehicle_id);
    const cur = byVehicle.get(t.vehicle_id) ?? {
      plate: v?.plate ?? "—",
      vehicleType: v?.vehicle_type ?? "",
      trips: 0,
      tonnage: 0,
    };
    cur.trips += t.trip_count;
    cur.tonnage =
      Math.round((cur.tonnage + Number(t.tonnage ?? 0)) * 1000) / 1000;
    byVehicle.set(t.vehicle_id, cur);
  }
  const trips = [...byVehicle.values()].sort((a, b) =>
    a.plate.localeCompare(b.plate, "tr"),
  );

  // Makineler: toplam saat ve mazot; L/saat yalnızca ikisinin birlikte girildiği kayıtlardan
  const byMachine = new Map<
    string,
    { hours: number; fuel: number; pairedHours: number; pairedFuel: number }
  >();
  for (const l of input.machineLogs ?? []) {
    const h = Number(l.hours ?? 0);
    const f = Number(l.fuel_liters ?? 0);
    const m = byMachine.get(l.vehicle_id) ?? {
      hours: 0,
      fuel: 0,
      pairedHours: 0,
      pairedFuel: 0,
    };
    m.hours += h;
    m.fuel += f;
    // Gün bazında toplanmış satırlarda eşleşen saat/mazot hazır gelir; tek kayıtta ikisi de girilmişse eşleşir
    if (l.paired_hours !== undefined) {
      m.pairedHours += Number(l.paired_hours);
      m.pairedFuel += Number(l.paired_fuel ?? 0);
    } else if (h && f) {
      m.pairedHours += h;
      m.pairedFuel += f;
    }
    byMachine.set(l.vehicle_id, m);
  }
  const machines: ReportMachine[] = [...byMachine]
    .map(([id, m]) => {
      const v = vehicleById.get(id);
      const norm = v?.fuel_norm_lph ? Number(v.fuel_norm_lph) : null;
      const fc = fuelCheck(m.pairedHours || null, m.pairedFuel || null, norm);
      return {
        plate: v?.plate ?? "—",
        vehicleType: v?.vehicle_type ?? "",
        hours: Math.round(m.hours * 100) / 100,
        fuel: Math.round(m.fuel * 100) / 100,
        lph: fc.lph,
        normLph: norm,
        over: fc.over,
      };
    })
    .sort((a, b) => a.plate.localeCompare(b.plate, "tr"));

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
    machines,
    totals: {
      amount: toTL(amountK),
      expenseNet: toTL(expenseNetK),
      expenseVat: toTL(sumK(expenses.map((e) => e.vat))),
      directCost: toTL(directK),
      generalExpense: toTL(expenseNetK - directK),
      difference: toTL(amountK - expenseNetK),
      trips: trips.reduce((s, t) => s + t.trips, 0),
      tonnage:
        Math.round(trips.reduce((s, t) => s + t.tonnage, 0) * 1000) / 1000,
      machineHours:
        Math.round(machines.reduce((s, m) => s + m.hours, 0) * 100) / 100,
      fuelLiters:
        Math.round(machines.reduce((s, m) => s + m.fuel, 0) * 100) / 100,
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
  const filter = { tenantId: tenant.id, siteId, from, to };
  const [prod, exp, tripDays, vehicles, machineDays, pay] = await Promise.all([
    supabase.rpc("production_summary", args),
    supabase.rpc("expense_summary", args),
    loadTripDays(supabase, filter),
    supabase
      .from("vehicles")
      .select("id, plate, vehicle_type, fuel_norm_lph")
      .eq("tenant_id", tenant.id),
    loadMachineDays(supabase, filter),
    loadContractorPayments(supabase, tenant.id, siteId, from, to),
  ]);
  const failed = [prod, exp, vehicles].find((r) => r.error);
  if (failed?.error) throw new Error("Rapor verisi alınamadı");

  return summarizeReport({
    site,
    tenantName: tenant.name,
    from,
    to,
    production: prod.data ?? [],
    expenses: exp.data ?? [],
    // Sefer toplamı: tonu girilmiş seferlerin tonu toplanır (tonsuzlar 0)
    trips: tripDays.map((t) => ({
      vehicle_id: t.vehicle_id,
      trip_count: t.trips,
      tonnage: t.tonnage,
    })),
    vehicles: vehicles.data ?? [],
    machineLogs: machineDays,
    vehicleCosts: {
      total: pay.total,
      lines: pay.contractors.reduce((n, c) => n + c.lines.length, 0),
    },
  });
}
