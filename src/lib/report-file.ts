import { NextResponse } from "next/server";
import { canManage, getContext } from "@/lib/context";
import { readFilters } from "@/lib/filters";
import { loadReport, type Report } from "@/lib/report";

// "Çevre Yolu 1. Kısım" → "Cevre-Yolu-1-Kisim" (dosya adları her sistemde açılsın)
export function slugTR(s: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "C",
    ğ: "g",
    Ğ: "G",
    ı: "i",
    İ: "I",
    ö: "o",
    Ö: "O",
    ş: "s",
    Ş: "S",
    ü: "u",
    Ü: "U",
  };
  return (
    s
      .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c])
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "santiye"
  );
}

export const reportFileName = (r: Report, ext: string) =>
  `Hafriyol_${slugTR(r.site.name)}_${r.from}_${r.to}.${ext}`;

// Excel/PDF indirme uçlarının ortak kısmı: yetki, filtre, rapor verisi
export async function reportForRequest(
  request: Request,
): Promise<Report | NextResponse> {
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role))
    return new NextResponse("Bu rapor için yetkiniz yok", { status: 403 });

  const url = new URL(request.url);
  const siteId = url.searchParams.get("santiye") ?? "";
  const filters = readFilters(
    {
      santiye: siteId,
      bas: url.searchParams.get("bas") ?? undefined,
      bit: url.searchParams.get("bit") ?? undefined,
    },
    [siteId],
  );
  if (!filters.siteId)
    return new NextResponse("Şantiye seçilmedi", { status: 400 });

  const report = await loadReport(
    supabase,
    tenant,
    filters.siteId,
    filters.from,
    filters.to,
  );
  if (!report) return new NextResponse("Şantiye bulunamadı", { status: 404 });
  return report;
}

export function fileResponse(
  body: Uint8Array,
  fileName: string,
  contentType: string,
) {
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
