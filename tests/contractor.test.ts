import { describe, expect, it } from "vitest";
import { computeContractorPayments } from "@/lib/contractor";

const v = (
  id: string,
  plate: string,
  extra: Partial<
    Parameters<typeof computeContractorPayments>[0]["vehicles"][number]
  > = {},
) => ({
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
      v("v4", "EKS-02", {
        vehicle_type: "Ekskavatör",
        ownership: "rented",
        contractor_name: "Kaya Makine",
        hourly_rate: 1250.5,
      }),
      v("v5", "34 ZZ 9", { contractor_name: null }),
    ],
    routes: [
      {
        id: "r1",
        name: "Ocak → Km 2",
        trip_price: 850,
        cycle_minutes: 60,
        distance_km: null,
      }, // günde en fazla 11
      {
        id: "r2",
        name: "Döküm sahası",
        trip_price: null,
        cycle_minutes: null,
        distance_km: null,
      },
    ],
    trips: [
      {
        vehicle_id: "v1",
        route_id: "r1",
        entry_date: "2026-10-01",
        trip_count: 10,
      },
      {
        vehicle_id: "v1",
        route_id: "r1",
        entry_date: "2026-10-02",
        trip_count: 12,
      }, // şüpheli
      {
        vehicle_id: "v2",
        route_id: "r1",
        entry_date: "2026-10-01",
        trip_count: 5,
      },
      {
        vehicle_id: "v3",
        route_id: "r1",
        entry_date: "2026-10-01",
        trip_count: 9,
      },
      {
        vehicle_id: "v5",
        route_id: "r2",
        entry_date: "2026-10-01",
        trip_count: 3,
      },
    ],
    machineLogs: [
      { vehicle_id: "v4", hours: 9.5 },
      { vehicle_id: "v4", hours: 8.25 },
    ],
  });

  it("taşeronları ayrı gruplar, öz mal aracı dahil etmez", () => {
    expect(result.contractors.map((c) => c.name)).toEqual([
      "34 ZZ 9 (taşeron adı girilmemiş)",
      "Kaya Makine",
      "Yılmaz Nakliyat",
    ]);
  });

  it("sefer × güzergâh ücreti ve saat × saatlik ücret hesaplar", () => {
    const yilmaz = result.contractors.find(
      (c) => c.name === "Yılmaz Nakliyat",
    )!;
    // (22 + 5) × 850 = 22.950
    expect(yilmaz.total).toBe(22950);
    expect(yilmaz.lines).toHaveLength(2);
    const kaya = result.contractors.find((c) => c.name === "Kaya Makine")!;
    // 17,75 saat × 1.250,50 = 22.196,375 → 22.196,38
    expect(kaya.lines[0]).toMatchObject({
      unit: "saat",
      quantity: 17.75,
      amount: 22196.38,
    });
    expect(result.total).toBe(45146.38);
  });

  it("ücreti tanımsız güzergâhı ve şüpheli günü işaretler", () => {
    const unnamed = result.contractors[0];
    expect(unnamed).toMatchObject({ missingPrice: true, total: 0 });
    const yilmaz = result.contractors.find(
      (c) => c.name === "Yılmaz Nakliyat",
    )!;
    expect(yilmaz.suspiciousDays).toEqual([
      {
        plate: "35 KY 101",
        date: "2026-10-02",
        route: "Ocak → Km 2",
        trips: 12,
        maxTrips: 11,
      },
    ]);
    expect(yilmaz.missingPrice).toBe(false);
  });
});

describe("günlük kira", () => {
  it("aracın çalıştığı gün sayısı × günlük kira; sefer ücreti ayrıca ödenmez", () => {
    const r = computeContractorPayments({
      vehicles: [
        {
          id: "k1",
          plate: "06 KR 501",
          vehicle_type: "Kamyon",
          ownership: "rented",
          contractor_name: "Kaya",
          hourly_rate: null,
          daily_rate: 9000,
        },
        {
          id: "e1",
          plate: "EKS-01",
          vehicle_type: "Ekskavatör",
          ownership: "rented",
          contractor_name: "Kaya",
          hourly_rate: 1500,
          daily_rate: null,
        },
      ],
      routes: [
        {
          id: "r1",
          name: "Ocak",
          trip_price: 900,
          cycle_minutes: null,
          distance_km: null,
        },
      ],
      trips: [
        {
          vehicle_id: "k1",
          route_id: "r1",
          entry_date: "2026-10-01",
          trip_count: 5,
        },
        {
          vehicle_id: "k1",
          route_id: "r1",
          entry_date: "2026-10-01",
          trip_count: 2,
        },
        {
          vehicle_id: "k1",
          route_id: "r1",
          entry_date: "2026-10-03",
          trip_count: 4,
        },
      ],
      machineLogs: [{ vehicle_id: "e1", hours: 9, log_date: "2026-10-01" }],
    });
    const kaya = r.contractors[0];
    // 2 gün × 9.000 = 18.000 ; 9 saat × 1.500 = 13.500
    expect(kaya.lines).toEqual([
      {
        plate: "06 KR 501",
        description: "Günlük kira",
        unit: "gün",
        quantity: 2,
        unitPrice: 9000,
        amount: 18000,
      },
      {
        plate: "EKS-01",
        description: "Makine çalışması",
        unit: "saat",
        quantity: 9,
        unitPrice: 1500,
        amount: 13500,
      },
    ]);
    expect(kaya.total).toBe(31500);
  });
});

describe("ücret geçmişi", () => {
  it("her gün o günkü ücretle hesaplanır; sonraki zam geçmişi değiştirmez", () => {
    const vehicles = [
      {
        id: "k1",
        plate: "34 HF 001",
        vehicle_type: "Kamyon",
        ownership: "rented",
        contractor_name: "Kaya",
        hourly_rate: null,
        daily_rate: 12000, // güncel ücret: hesapta kullanılmaz
      },
      {
        id: "t1",
        plate: "35 KY 101",
        vehicle_type: "Kamyon",
        ownership: "subcontractor",
        contractor_name: "Kaya",
        hourly_rate: null,
      },
    ];
    const routes = [
      {
        id: "r1",
        name: "Ocak",
        trip_price: 900,
        cycle_minutes: null,
        distance_km: null,
      },
    ];
    const trip = (vehicle_id: string, entry_date: string, trip_count = 1) => ({
      vehicle_id,
      route_id: "r1",
      entry_date,
      trip_count,
    });
    const history = {
      vehicle: new Map([
        [
          "k1",
          [
            {
              from: "2000-01-01",
              value: { hourly_rate: null, daily_rate: 9000 },
            },
            {
              from: "2026-10-03",
              value: { hourly_rate: null, daily_rate: 12000 },
            },
          ],
        ],
      ]),
      route: new Map([
        [
          "r1",
          [
            { from: "2000-01-01", value: 850 },
            { from: "2026-10-02", value: 900 },
          ],
        ],
      ]),
    };
    const r = computeContractorPayments({
      vehicles,
      routes,
      trips: [
        trip("k1", "2026-10-01", 5),
        trip("k1", "2026-10-02", 3),
        trip("k1", "2026-10-03", 4),
        trip("t1", "2026-10-01", 2),
        trip("t1", "2026-10-02", 3),
      ],
      machineLogs: [],
      history,
    });
    const kaya = r.contractors[0];
    // 34 HF 001: 2 gün × 9.000 + 1 gün × 12.000 = 30.000
    // 35 KY 101: 2 sefer × 850 + 3 sefer × 900 = 4.400
    expect(kaya.lines).toEqual([
      expect.objectContaining({
        plate: "34 HF 001",
        unit: "gün",
        quantity: 2,
        unitPrice: 9000,
        amount: 18000,
      }),
      expect.objectContaining({
        plate: "34 HF 001",
        unit: "gün",
        quantity: 1,
        unitPrice: 12000,
        amount: 12000,
      }),
      expect.objectContaining({
        plate: "35 KY 101",
        unit: "sefer",
        quantity: 2,
        unitPrice: 850,
        amount: 1700,
      }),
      expect.objectContaining({
        plate: "35 KY 101",
        unit: "sefer",
        quantity: 3,
        unitPrice: 900,
        amount: 2700,
      }),
    ]);
    expect(kaya.total).toBe(34400);

    // Aynı dönem, bugün kira 15.000'e çıksa da değişmez (zam 28.10'dan geçerli)
    history.vehicle.get("k1")!.push({
      from: "2026-10-28",
      value: { hourly_rate: null, daily_rate: 15000 },
    });
    const again = computeContractorPayments({
      vehicles,
      routes,
      trips: [
        trip("k1", "2026-10-01", 5),
        trip("k1", "2026-10-02", 3),
        trip("k1", "2026-10-03", 4),
      ],
      machineLogs: [],
      history,
    });
    expect(again.total).toBe(30000);
  });
});

import { validFrom, valueAt } from "@/lib/prices";

describe("geçerli ücret", () => {
  const list = [
    { from: "2000-01-01", value: 1 },
    { from: "2026-10-02", value: 2 },
  ];
  it("tarihte geçerli olan değeri bulur", () => {
    expect(valueAt(list, "1999-12-31")).toBeNull();
    expect(valueAt(list, "2026-10-01")).toBe(1);
    expect(valueAt(list, "2026-10-02")).toBe(2);
    expect(valueAt(undefined, "2026-10-02")).toBeNull();
  });
  it("geçerlilik başlangıcı boşsa bugün, ileri tarih reddedilir", () => {
    expect(validFrom(null, "2026-10-27")).toBe("2026-10-27");
    expect(validFrom("2026-10-01", "2026-10-27")).toBe("2026-10-01");
    expect(validFrom("2026-10-28", "2026-10-27")).toBeNull();
  });
});
