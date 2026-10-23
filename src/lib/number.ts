// Türkçe sayı girişi: "1.234,56" → 1234.56, "120,5" → 120.5, "120.5" → 120.5
//
// Kural: virgül varsa ondalık ayracı virgüldür, noktalar binlik ayraçtır.
// Virgül yoksa nokta, yalnızca "1.234" / "12.345.678" gibi tam binlik kalıbındaysa
// binlik ayraç sayılır; diğer durumlarda ("120.5") ondalık ayraçtır.
// Geçersiz girişte null döner.
export function parseTrNumber(input: string): number | null {
  const s = input.replace(/[\s ]/g, "");
  if (s === "") return null;

  let normalized: string;
  if (s.includes(",")) {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) return null;
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, "");
  } else if (/^-?\d+(\.\d+)?$/.test(s)) {
    normalized = s;
  } else {
    return null;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// Ondalık basamak sayısı (ör. 12.345 → 3). parseTrNumber çıktısı için.
export function decimalPlaces(n: number): number {
  const s = String(n);
  if (s.includes("e")) return 20;
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

// Sayıyı Türkçe biçimde gösterir: 1234.5 → "1.234,5"
export function formatTrNumber(n: number | null | undefined, maxDecimals = 3): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: maxDecimals }).format(n);
}
