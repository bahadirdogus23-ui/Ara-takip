import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { loadContractorPayments } from "@/lib/contractor";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { formatDateTR } from "@/lib/format";
import { fileResponse } from "@/lib/report-file";

const TL = '#,##0.00 "₺"';

export async function GET(request: Request) {
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role))
    return new NextResponse("Bu rapor için yetkiniz yok", { status: 403 });

  const url = new URL(request.url);
  const { data: sites } = await supabase
    .from("sites")
    .select("id")
    .eq("tenant_id", tenant.id);
  const { siteId, from, to } = readFilters(
    {
      santiye: url.searchParams.get("santiye") ?? undefined,
      bas: url.searchParams.get("bas") ?? undefined,
      bit: url.searchParams.get("bit") ?? undefined,
    },
    (sites ?? []).map((s) => s.id),
  );
  const { contractors, total } = await loadContractorPayments(
    supabase,
    tenant.id,
    siteId,
    from,
    to,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hafriyol";
  const ws = wb.addWorksheet("Taşeron hakedişi");
  ws.columns = [
    { header: "Taşeron / firma", key: "name", width: 26 },
    { header: "Plaka", key: "plate", width: 14 },
    { header: "Açıklama", key: "description", width: 24 },
    {
      header: "Miktar",
      key: "quantity",
      width: 10,
      style: { numFmt: "#,##0.##" },
    },
    { header: "Birim", key: "unit", width: 8 },
    {
      header: "Birim ücret",
      key: "unitPrice",
      width: 14,
      style: { numFmt: TL },
    },
    { header: "Tutar", key: "amount", width: 16, style: { numFmt: TL } },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const c of contractors) {
    for (const l of c.lines)
      ws.addRow({ name: c.name, ...l, unitPrice: l.unitPrice ?? "ücret yok" });
    const sub = ws.addRow({ name: `${c.name} toplam`, amount: c.total });
    sub.font = { bold: true };
  }
  const t = ws.addRow({
    name: `Genel toplam (${formatDateTR(from)} – ${formatDateTR(to)})`,
    amount: total,
  });
  t.font = { bold: true };
  t.border = { top: { style: "thin" } };

  const body = new Uint8Array(await wb.xlsx.writeBuffer());
  return fileResponse(
    body,
    `Hafriyol_Taseron_Hakedis_${from}_${to}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
