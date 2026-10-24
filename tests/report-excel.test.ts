import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { slugTR } from "@/lib/report-file";
import { buildReportWorkbook } from "@/lib/report-excel";
import { sampleReport } from "./report.fixture";

describe("Excel çıktısı", () => {
  it("dört sayfa üretir, toplamlar formül + doğru sonuç içerir", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildReportWorkbook(sampleReport())).buffer as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Özet", "İmalat", "Giderler", "Seferler"]);

    const p = wb.getWorksheet("İmalat")!;
    expect(p.getCell("B2").value).toBe("Kazı (yumuşak toprak)");
    expect(p.getCell("C2").value).toBe("m³");
    expect(p.getCell("D2").value).toBe(200);
    expect(p.getCell("F2").numFmt).toBe('#,##0.00 "₺"');
    const total = p.getCell("F4").value as { formula: string; result: number };
    expect(total).toMatchObject({ formula: "SUM(F2:F3)", result: 17100 });

    const g = wb.getWorksheet("Giderler")!;
    expect((g.getCell("E4").value as { result: number }).result).toBe(5081.47);

    const s = wb.getWorksheet("Özet")!;
    expect(s.getCell("B2").value).toBe("Çevre Yolu 1. Kısım");
    expect(s.getCell("B12").value).toBe(12865.44);

    const t = wb.getWorksheet("Seferler")!;
    expect(t.getCell("A3").value).toBe("44 ŞĞ 07");
    expect((t.getCell("C4").value as { result: number }).result).toBe(25);
  });

  it("dosya adında Türkçe karakter ve boşluk bırakmaz", () => {
    expect(slugTR("Çevre Yolu 1. Kısım / Ağrı")).toBe("Cevre-Yolu-1-Kisim-Agri");
    expect(slugTR("***")).toBe("santiye");
  });
});
