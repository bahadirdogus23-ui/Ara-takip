import { describe, expect, it } from "vitest";
import { computeContractorPayments } from "@/lib/contractor";

const v = (id: string, plate: string, extra: Partial<Parameters<typeof computeContractorPayments>[0]["vehicles"][number]> = {}) => ({
  id,
  plate,
  vehicle_type: "Kamyon",
  ownership: "subcontractor",
  contractor_name: "Yılmaz Nakliyat",
  hourly_rate: null,
  ...extra,
});

describe("taşeron hakedişi", () => {
  const result = computeContractorPayments({
    vehicles: [
      v("v1", "35 KY 101"),
      v("v2", "35 KY 102"),
      v("v3", "06 ÖZ 001", { ownership: "own" }), // öz mal: dahil değil
      v("v4", "EKS-02", { vehicle_type: "Ekskavatör", ownership: "rented", contractor_name: "Kaya Makine", hourly_rate: 1250.5 }),
      v("v5", "34 ZZ 9", { contractor_name: null }),
    ],
    routes: [
      { id: "r1", name: "Ocak → Km 2", trip_price: 850, cycle_minutes: 60, distance_km: null }, // günde en fazla 11
      { id: "r2", name: "Döküm sahası", trip_price: null, cycle_minutes: null, distance_km: null },
    ],
    trips: [
      { vehicle_id: "v1", route_id: "r1", entry_date: "2026-10-01", trip_count: 10 },
      { vehicle_id: "v1", route_id: "r1", entry_date: "2026-10-02", trip_count: 12 }, // şüpheli
      { vehicle_id: "v2", route_id: "r1", entry_date: "2026-10-01", trip_count: 5 },
      { vehicle_id: "v3", route_id: "r1", entry_date: "2026-10-01", trip_count: 9 },
      { vehicle_id: "v5", route_id: "r2", entry_date: "2026-10-01", trip_count: 3 },
    ],
    machineLogs: [
      { vehicle_id: "v4", hours: 9.5 },
      { vehicle_id: "v4", hours: 8.25 },
    ],
  });

  it("taşeronları ayrı gruplar, öz mal aracı dahil etmez", () => {
    expect(result.contractors.map((c) => c.name)).toEqual(["34 ZZ 9 (taşeron adı girilmemiş)", "Kaya Makine", "Yılmaz Nakliyat"]);
  });

  it("sefer × güzergâh ücreti ve saat × saatlik ücret hesaplar", () => {
    const yilmaz = result.contractors.find((c) => c.name === "Yılmaz Nakliyat")!;
    // (22 + 5) × 850 = 22.950
    expect(yilmaz.total).toBe(22950);
    expect(yilmaz.lines).toHaveLength(2);
    const kaya = result.contractors.find((c) => c.name === "Kaya Makine")!;
    // 17,75 saat × 1.250,50 = 22.196,375 → 22.196,38
    expect(kaya.lines[0]).toMatchObject({ unit: "saat", quantity: 17.75, amount: 22196.38 });
    expect(result.total).toBe(45146.38);
  });

  it("ücreti tanımsız güzergâhı ve şüpheli günü işaretler", () => {
    const unnamed = result.contractors[0];
    expect(unnamed).toMatchObject({ missingPrice: true, total: 0 });
    const yilmaz = result.contractors.find((c) => c.name === "Yılmaz Nakliyat")!;
    expect(yilmaz.suspiciousDays).toEqual([{ plate: "35 KY 101", date: "2026-10-02", route: "Ocak → Km 2", trips: 12, maxTrips: 11 }]);
    expect(yilmaz.missingPrice).toBe(false);
  });
});
