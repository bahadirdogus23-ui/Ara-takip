import { describe, expect, it } from "vitest";
import { sampleReport } from "./report.fixture";

describe("dönem raporu", () => {
  const r = sampleReport();

  it("imalat ve gider toplamlarını kuruşla hesaplar", () => {
    expect(r.totals).toMatchObject({
      amount: 17100,
      expenseNet: 4234.56,
      expenseVat: 846.91,
      directCost: 3000,
      generalExpense: 1234.56, // iş kalemine bağlanmamış işçilik
      difference: 12865.44, // 17.100 − 4.234,56
    });
  });

  it("seferleri araç bazında toplar, boş tonajı sıfır sayar", () => {
    expect(r.trips).toEqual([
      { plate: "06 ABC 123", vehicleType: "Kamyon", trips: 20, tonnage: 290 },
      {
        plate: "44 ŞĞ 07",
        vehicleType: "Damperli kamyon",
        trips: 5,
        tonnage: 112.5,
      },
    ]);
    expect(r.totals).toMatchObject({ trips: 25, tonnage: 402.5 });
  });

  it("fiyatı olmayan kalemde boş değerleri null bırakır", () => {
    expect(r.items[1]).toMatchObject({
      unitPrice: null,
      progressPercent: null,
      unitCost: null,
      amount: 0,
    });
  });

  it("makine saat ve mazotunu toplar, normu aşanı işaretler", () => {
    // 330 L ÷ 17,5 saat = 18,9 L/saat > 15 × 1,2 = 18
    expect(r.machines).toEqual([
      {
        plate: "EKS-01",
        vehicleType: "Ekskavatör",
        hours: 19.5,
        fuel: 330,
        lph: 18.9,
        normLph: 15,
        over: true,
      },
    ]);
    expect(r.totals).toMatchObject({ machineHours: 19.5, fuelLiters: 330 });
  });

  it("gider türlerini Türkçe adlandırır", () => {
    expect(r.expenses.map((e) => e.label)).toEqual([
      "Mazot / yakıt",
      "İşçilik",
    ]);
  });
});

import { summarizeReport } from "@/lib/report";

describe("dönem raporunda araç kirası", () => {
  it("kiralık/taşeron araç maliyetini gidere ve tutar − gider farkına katar", () => {
    const base = sampleReport();
    const r = summarizeReport({
      site: base.site,
      tenantName: base.tenantName,
      from: base.from,
      to: base.to,
      production: [],
      expenses: [
        {
          category: "fuel",
          amount: 18500,
          vat_amount: 3700,
          total: 22200,
          entry_count: 1,
        },
      ],
      trips: [],
      vehicles: [],
      vehicleCosts: { total: 23400, lines: 3 },
    });
    expect(r.expenses.at(-1)).toMatchObject({
      label: "Araç kirası / taşeron (otomatik)",
      amount: 23400,
      vat: 0,
    });
    expect(r.totals).toMatchObject({
      expenseNet: 41900,
      expenseVat: 3700,
      difference: -41900,
      generalExpense: 41900,
    });
  });
});

import { missingTonnage } from "@/lib/report";

describe("kantar tonu eksik seferler", () => {
  it("yalnız ton birimli kaleme bağlı güzergâhlardaki tonsuz seferleri sayar", () => {
    const items = [
      { work_item_id: "i-ton", name: "Hafriyat nakli", unit: "ton" },
      { work_item_id: "i-sefer", name: "Nakliye", unit: "sefer" },
    ];
    const routes = [
      { id: "r1", work_item_id: "i-ton" },
      { id: "r2", work_item_id: "i-sefer" },
      { id: "r3", work_item_id: null },
    ];
    const days = [
      { route_id: "r1", untonned_trips: 3 },
      { route_id: "r1", untonned_trips: 2 },
      { route_id: "r2", untonned_trips: 7 },
      { route_id: "r3", untonned_trips: 4 },
      { route_id: null, untonned_trips: 9 },
    ];
    expect(missingTonnage(items, routes, days)).toEqual([
      { item: "Hafriyat nakli", trips: 5 },
    ]);
    expect(missingTonnage(items, routes, [])).toEqual([]);
  });
});
