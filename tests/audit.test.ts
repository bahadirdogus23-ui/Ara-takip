import { describe, expect, it } from "vitest";
import { describeAudit, formatValue } from "@/lib/audit";

const base = {
  id: 1,
  changed_at: "2026-10-28T10:00:00Z",
  changed_by_email: "sahip@firma.com",
};

describe("işlem geçmişi", () => {
  it("değişiklikte yalnız değişen alanları eski → yeni gösterir", () => {
    const line = describeAudit({
      ...base,
      table_name: "machine_logs",
      action: "UPDATE",
      old_data: {
        id: "x",
        hours: 8,
        fuel_liters: 120,
        note: null,
        created_by: "u",
      },
      new_data: {
        id: "x",
        hours: 9.5,
        fuel_liters: 120,
        note: "arıza",
        created_by: "u",
      },
    });
    expect(line.title).toBe("Makine kaydı değiştirildi");
    expect(line.who).toBe("sahip@firma.com");
    expect(line.details).toEqual(["Saat: 8 → 9,5", "Not: — → arıza"]);
  });

  it("silinen seferi tarih, araç ve sayıyla özetler", () => {
    const names = new Map([["v1", "34 AB 123"]]);
    const line = describeAudit(
      {
        ...base,
        table_name: "trip_entries",
        action: "DELETE",
        old_data: {
          entry_date: "2026-10-27",
          vehicle_id: "v1",
          trip_count: 12,
          tonnage: null,
          route_id: null,
        },
        new_data: null,
      },
      names,
    );
    expect(line.title).toBe("Sefer silindi");
    expect(line.details).toEqual([
      "Tarih: 27.10.2026",
      "Araç: 34 AB 123",
      "Sefer: 12",
    ]);
  });

  it("ücret ve rol değerlerini Türkçe biçimler", () => {
    expect(formatValue("daily_rate", "12000")).toBe("12.000 TL");
    expect(formatValue("role", "field")).toBe("saha personeli");
    expect(formatValue("active", false)).toBe("hayır");
    expect(formatValue("vehicle_id", "bilinmeyen")).toBe("—");
  });
});
