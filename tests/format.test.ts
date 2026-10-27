import { describe, expect, it } from "vitest";
import { formatDateTR, formatTL, isoDateTR, monthRangeTR } from "@/lib/format";

describe("tarih ve para biçimleri", () => {
  it("gece yarısından sonra Türkiye tarihini kullanır (UTC değil)", () => {
    // UTC 31 Ekim 21:30 = Türkiye 1 Kasım 00:30
    expect(isoDateTR(new Date("2026-10-31T21:30:00Z"))).toBe("2026-11-01");
  });

  it("ay aralığını doğru verir, artık yılı dahil", () => {
    expect(monthRangeTR(new Date("2028-02-10T09:00:00Z"))).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(monthRangeTR(new Date("2026-12-15T09:00:00Z"))).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });

  it("TL biçimi Türkçe ayraç kullanır", () => {
    expect(formatTL(17100)).toBe("₺17.100,00");
    expect(formatTL(null)).toBe("₺0,00");
  });

  it("tarihi gün.ay.yıl yazar", () => {
    expect(formatDateTR("2026-10-01")).toBe("01.10.2026");
    expect(formatDateTR(null)).toBe("—");
  });
});

import { workDateTR } from "@/lib/format";

describe("iş günü", () => {
  // Türkiye UTC+3: 22:00 TR = 19:00Z, 04:00 TR (ertesi gün) = 01:00Z
  const at = (iso: string) => new Date(iso);
  it("gece yarısı başlangıçta takvim günüdür", () => {
    expect(workDateTR(at("2026-10-27T19:00:00Z"))).toBe("2026-10-27");
    expect(workDateTR(at("2026-10-28T01:00:00Z"))).toBe("2026-10-28");
  });
  it("06:00 başlangıçta 22:00–04:00 vardiyası tek iş günüdür", () => {
    expect(workDateTR(at("2026-10-27T19:00:00Z"), 6)).toBe("2026-10-27");
    expect(workDateTR(at("2026-10-28T01:00:00Z"), 6)).toBe("2026-10-27");
    // 06:00 TR = 03:00Z: yeni iş günü
    expect(workDateTR(at("2026-10-28T03:00:00Z"), 6)).toBe("2026-10-28");
    expect(workDateTR(at("2026-10-28T02:59:00Z"), 6)).toBe("2026-10-27");
  });
});
