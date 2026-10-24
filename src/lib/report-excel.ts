import ExcelJS from "exceljs";
import { formatDateTR, isoDateTR } from "@/lib/format";
import { unitLabel, type Report } from "@/lib/report";

const TL = '#,##0.00 "₺"';
const QTY = "#,##0.###";
const PCT = '0.00"%"';

function header(sheet: ExcelJS.Worksheet, columns: { header: string; key: string; width: number; numFmt?: string }[]) {
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8D6" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

// Toplam satırı: formül + hesaplanmış sonuç (formülü hesaplamayan görüntüleyiciler için)
function totalRow(sheet: ExcelJS.Worksheet, label: string, sums: Record<string, number>) {
  const last = sheet.rowCount;
  const row = sheet.addRow({});
  row.getCell(1).value = label;
  for (const [key, result] of Object.entries(sums)) {
    const col = sheet.getColumn(key);
    const letter = col.letter;
    row.getCell(col.number).value = last >= 2 ? { formula: `SUM(${letter}2:${letter}${last})`, result } : result;
  }
  row.font = { bold: true };
  row.border = { top: { style: "thin" } };
}

export async function buildReportWorkbook(r: Report): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hafriyol";
  wb.created = new Date();

  // Özet
  const s = wb.addWorksheet("Özet");
  s.columns = [{ width: 32 }, { width: 22 }];
  const rows: [string, string | number, string?][] = [
    ["Firma", r.tenantName],
    ["Şantiye", r.site.name],
    ["Kod", r.site.code ?? ""],
    ["İşveren", r.site.employer ?? ""],
    ["Dönem", `${formatDateTR(r.from)} – ${formatDateTR(r.to)}`],
    ["Rapor tarihi", formatDateTR(isoDateTR())],
    ["İmalat tutarı (KDV hariç)", r.totals.amount, TL],
    ["Gider (KDV hariç)", r.totals.expenseNet, TL],
    ["  İş kalemlerine bağlı", r.totals.directCost, TL],
    ["  Genel gider", r.totals.generalExpense, TL],
    ["Gider KDV", r.totals.expenseVat, TL],
    ["Tutar − gider (KDV hariç)", r.totals.difference, TL],
    ["Toplam sefer", r.totals.trips],
    ["Toplam tonaj", r.totals.tonnage, QTY],
  ];
  for (const [label, value, fmt] of rows) {
    const row = s.addRow([label, value]);
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  s.getColumn(1).font = { bold: true };
  s.addRow([]);
  s.addRow(["Bu rapor iç takip içindir, resmî hakediş yerine geçmez."]).font = { italic: true, color: { argb: "FF8A5A00" } };

  // İmalat
  const p = wb.addWorksheet("İmalat");
  header(p, [
    { header: "Poz no", key: "code", width: 14 },
    { header: "İş kalemi", key: "name", width: 36 },
    { header: "Birim", key: "unit", width: 8 },
    { header: "Miktar", key: "quantity", width: 14, numFmt: QTY },
    { header: "Birim fiyat", key: "unitPrice", width: 14, numFmt: TL },
    { header: "Tutar", key: "amount", width: 16, numFmt: TL },
    { header: "Planlanan miktar", key: "plannedQuantity", width: 16, numFmt: QTY },
    { header: "Gerçekleşme", key: "progressPercent", width: 13, numFmt: PCT },
    { header: "Doğrudan gider", key: "directCost", width: 16, numFmt: TL },
    { header: "Birim maliyet", key: "unitCost", width: 14, numFmt: TL },
  ]);
  for (const i of r.items) p.addRow({ ...i, unit: unitLabel(i.unit) });
  totalRow(p, "Toplam", { amount: r.totals.amount, directCost: r.totals.directCost });
  p.autoFilter = { from: "A1", to: "J1" };

  // Giderler
  const e = wb.addWorksheet("Giderler");
  header(e, [
    { header: "Gider türü", key: "label", width: 22 },
    { header: "Kayıt sayısı", key: "count", width: 12 },
    { header: "Tutar (KDV hariç)", key: "amount", width: 18, numFmt: TL },
    { header: "KDV", key: "vat", width: 14, numFmt: TL },
    { header: "Toplam", key: "total", width: 16, numFmt: TL },
  ]);
  for (const x of r.expenses) e.addRow(x);
  totalRow(e, "Toplam", {
    amount: r.totals.expenseNet,
    vat: r.totals.expenseVat,
    total: Math.round((r.totals.expenseNet + r.totals.expenseVat) * 100) / 100,
  });

  // Seferler
  const t = wb.addWorksheet("Seferler");
  header(t, [
    { header: "Plaka", key: "plate", width: 14 },
    { header: "Araç türü", key: "vehicleType", width: 20 },
    { header: "Sefer", key: "trips", width: 10 },
    { header: "Tonaj", key: "tonnage", width: 12, numFmt: QTY },
  ]);
  for (const x of r.trips) t.addRow(x);
  totalRow(t, "Toplam", { trips: r.totals.trips, tonnage: r.totals.tonnage });

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
