// Tarih ve para biçimlendirme. Şantiyeler Türkiye saatinde çalışır.

const TZ = "Europe/Istanbul";

// Verilen anın Türkiye saatine göre tarihi: "2026-10-22"
export function isoDateTR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// İş günü: şantiyenin iş günü başlangıç saatinden önceki anlar önceki güne sayılır
// (ör. başlangıç 06:00 ise 03:00'teki sefer dünün iş gününe yazılır). Türkiye'de yaz saati yok.
export function workDateTR(now: Date = new Date(), dayStartHour = 0): string {
  return isoDateTR(new Date(now.getTime() - dayStartHour * 3_600_000));
}

// İçinde bulunulan ayın ilk ve son günü (Türkiye saatine göre)
export function monthRangeTR(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const [y, m] = isoDateTR(now).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});
export const formatTL = (v: number | null | undefined) => tl.format(v ?? 0);

// "2026-10-22" → "22.10.2026"
// Zaman damgası: "27.10.2026 14:32" (Türkiye saati)
export function formatDateTimeTR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
