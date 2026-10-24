import { summarizeReport } from "@/lib/report";

// Veritabanı testi T9 ile aynı örnek: Ekim 2026, A Hafriyat, Çevre Yolu 1. Kısım
export const sampleReport = () =>
  summarizeReport({
    site: { id: "s1", name: "Çevre Yolu 1. Kısım", code: "ÇY-1", employer: "Karayolları" },
    tenantName: "A Hafriyat Ltd. Şti.",
    from: "2026-10-01",
    to: "2026-10-31",
    production: [
      {
        work_item_id: "w1",
        code: "15.150.1001",
        name: "Kazı (yumuşak toprak)",
        unit: "m3",
        quantity: 200,
        unit_price: 85.5,
        amount: 17100,
        planned_quantity: 10000,
        progress_percent: 2,
        direct_cost: 3000,
        unit_cost: 15,
      },
      {
        work_item_id: "w2",
        code: null as unknown as string,
        name: "Stabilize serme",
        unit: "m2",
        quantity: 0,
        unit_price: null as unknown as number,
        amount: 0,
        planned_quantity: null as unknown as number,
        progress_percent: null as unknown as number,
        direct_cost: 0,
        unit_cost: null as unknown as number,
      },
    ],
    expenses: [
      { category: "fuel", amount: 3000, vat_amount: 600, total: 3600, entry_count: 1 },
      { category: "labor", amount: 1234.56, vat_amount: 246.91, total: 1481.47, entry_count: 1 },
    ],
    trips: [
      { vehicle_id: "v1", trip_count: 12, tonnage: 290 },
      { vehicle_id: "v1", trip_count: 8, tonnage: null },
      { vehicle_id: "v2", trip_count: 5, tonnage: 112.5 },
    ],
    vehicles: [
      { id: "v1", plate: "06 ABC 123", vehicle_type: "Kamyon" },
      { id: "v2", plate: "44 ŞĞ 07", vehicle_type: "Damperli kamyon" },
    ],
  });
