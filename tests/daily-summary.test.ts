import { describe, expect, it } from "vitest";
import { buildDailySummary, whatsappUrl } from "@/lib/daily-summary";

describe("gün sonu WhatsApp özeti", () => {
  const text = buildDailySummary({
    tenantName: "A Hafriyat",
    siteName: "Köy Yolu",
    date: "2026-10-25",
    trips: [
      { plate: "35 KY 101", trips: 12, tons: 240 },
      { plate: "35 KY 102", trips: 9, tons: 166.5 },
    ],
    production: [{ name: "Kazı", quantity: 1234.5, unit: "m³" }],
    machines: [{ plate: "EKS-01", hours: 9.5, fuel: 180 }],
    alerts: ["35 KY 101: 12 sefer (en fazla 11)"],
  });

  it("toplamları ve Türkçe sayıları yazar", () => {
    expect(text).toContain("*Köy Yolu* · 25.10.2026");
    expect(text).toContain("🚚 *Sefer: 21* (~407 ton)");
    expect(text).toContain("• Kazı: 1.234,5 m³");
    expect(text).toContain("• EKS-01: 9,5 saat, 180 L");
    expect(text).toContain("⚠️ *Dikkat*");
  });

  it("para tutarı içermez", () => {
    expect(text).not.toMatch(/₺|TL/);
  });

  it("boş günü açıkça belirtir, WhatsApp bağlantısını kodlar", () => {
    const empty = buildDailySummary({ tenantName: "A", siteName: "S", date: "2026-10-25", trips: [], production: [], machines: [], alerts: [] });
    expect(empty).toContain("• Sefer girilmedi");
    expect(empty).not.toContain("Makine");
    expect(whatsappUrl("a b\nç")).toBe("https://wa.me/?text=a%20b%0A%C3%A7");
  });
});
