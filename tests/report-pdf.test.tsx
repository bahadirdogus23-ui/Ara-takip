import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildReportPdf } from "@/lib/report-pdf";
import { sampleReport } from "./report.fixture";

describe("PDF çıktısı", () => {
  it("Türkçe karakterleri ve toplamları doğru yazar", async () => {
    const pdf = await buildReportPdf(sampleReport());
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");

    // pdftotext ile metne çevirip kontrol et (font gömülmezse ş/ğ/ı bozuk çıkar)
    const dir = mkdtempSync(path.join(tmpdir(), "hafriyol-pdf-"));
    const file = path.join(dir, "rapor.pdf");
    writeFileSync(file, pdf);
    const text = execFileSync("pdftotext", ["-layout", file, "-"]).toString();

    for (const expected of [
      "Çevre Yolu 1. Kısım",
      "A Hafriyat Ltd. Şti.",
      "Kazı (yumuşak toprak)",
      "44 ŞĞ 07",
      "Mazot / yakıt",
      "İşçilik",
      "₺17.100,00",
      "₺12.865,44",
      "₺5.081,47",
      "resmî hakediş yerine geçmez",
    ]) {
      expect(text).toContain(expected);
    }
  }, 30_000);
});
