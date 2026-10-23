import { describe, expect, it, vi } from "vitest";
import { readFilters } from "@/lib/filters";

describe("liste filtreleri", () => {
  it("geçersiz değerlerde bu aya ve tüm şantiyelere döner", () => {
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    expect(readFilters({ santiye: "baska-firma", bas: "dün", bit: "" }, ["a"])).toEqual({
      siteId: "",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    vi.useRealTimers();
  });

  it("ters girilmiş tarihleri düzeltir, bilinen şantiyeyi kabul eder", () => {
    expect(readFilters({ santiye: "a", bas: "2026-10-20", bit: "2026-10-01" }, ["a"])).toEqual({
      siteId: "a",
      from: "2026-10-01",
      to: "2026-10-20",
    });
  });
});
