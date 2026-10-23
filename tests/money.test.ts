import { describe, expect, it } from "vitest";
import { expenseTotals, vatKurus } from "@/lib/money";

describe("para hesapları", () => {
  it("veritabanı testi T9b ile aynı sonucu verir", () => {
    // 1.234,56 TL'nin %20 KDV'si = 246,91 TL, toplam 1.481,47 TL
    expect(expenseTotals([{ amount: 1234.56, vat_rate: 20 }])).toEqual({ net: 1234.56, vat: 246.91, total: 1481.47 });
  });

  it("kayan nokta hatasıyla yanlış yuvarlamaz", () => {
    // 10,05 × %10 = 1,005 → 1,01 (düz JS: 10.05*10 = 100.4999… → 1,00 olurdu)
    expect(vatKurus(10.05, 10)).toBe(101);
  });

  it("KDV satır satır yuvarlanıp toplanır", () => {
    // Her biri 0,333 → 0,33; üç satır = 0,99 (toplamdan hesaplansa 1,00 olurdu)
    const rows = Array.from({ length: 3 }, () => ({ amount: 1.11, vat_rate: 30 }));
    expect(expenseTotals(rows)).toEqual({ net: 3.33, vat: 0.99, total: 4.32 });
  });

  it("0,1 + 0,2 gibi toplamlar tam çıkar", () => {
    expect(expenseTotals([{ amount: 0.1, vat_rate: 0 }, { amount: 0.2, vat_rate: 0 }]).net).toBe(0.3);
  });
});
