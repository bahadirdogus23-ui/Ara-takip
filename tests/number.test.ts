import { describe, expect, it } from "vitest";
import { formatTrNumber, parseTrNumber } from "@/lib/number";

describe("Türkçe sayı ayrıştırma", () => {
  it.each([
    ["120,5", 120.5],
    ["1.234,56", 1234.56],
    ["12.345.678,9", 12345678.9],
    ["1.234", 1234], // tam binlik kalıbı → binlik ayraç
    ["120.5", 120.5], // binlik kalıbı değil → ondalık
    ["1.5", 1.5],
    ["  85,50 ", 85.5],
    ["1 234,5", 1234.5],
    ["0", 0],
    ["-3,5", -3.5],
  ])("%s → %d", (input, expected) => {
    expect(parseTrNumber(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "12a", "1.23,4", "--1", ",5,"])("%s geçersiz", (input) => {
    expect(parseTrNumber(input)).toBeNull();
  });

  it("sayıyı Türkçe gösterir", () => {
    expect(formatTrNumber(1234.5)).toBe("1.234,5");
    expect(formatTrNumber(null)).toBe("—");
  });
});
