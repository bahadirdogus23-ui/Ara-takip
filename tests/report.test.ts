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
      { plate: "44 ŞĞ 07", vehicleType: "Damperli kamyon", trips: 5, tonnage: 112.5 },
    ]);
    expect(r.totals).toMatchObject({ trips: 25, tonnage: 402.5 });
  });

  it("fiyatı olmayan kalemde boş değerleri null bırakır", () => {
    expect(r.items[1]).toMatchObject({ unitPrice: null, progressPercent: null, unitCost: null, amount: 0 });
  });

  it("gider türlerini Türkçe adlandırır", () => {
    expect(r.expenses.map((e) => e.label)).toEqual(["Mazot / yakıt", "İşçilik"]);
  });
});
