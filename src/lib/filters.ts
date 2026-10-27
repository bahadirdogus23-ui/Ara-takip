import { monthRangeTR } from "@/lib/format";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Adres çubuğundaki filtreleri doğrular; geçersizse bu ay ve tüm şantiyeler
export function readFilters(
  params: { santiye?: string; bas?: string; bit?: string },
  siteIds: string[],
): { siteId: string; from: string; to: string } {
  const month = monthRangeTR();
  let from = params.bas && ISO.test(params.bas) ? params.bas : month.from;
  let to = params.bit && ISO.test(params.bit) ? params.bit : month.to;
  if (from > to) [from, to] = [to, from];
  const siteId =
    params.santiye && siteIds.includes(params.santiye) ? params.santiye : "";
  return { siteId, from, to };
}
