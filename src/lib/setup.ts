import { parseTrNumber } from "@/lib/number";
import { normalizePlate, UNITS } from "@/lib/validation";

// Yol / altyapı / hafriyat işlerinde en sık kullanılan iş kalemleri.
// Kurulumda işaretlenenler şantiyeye eklenir; birim fiyat sonradan girilebilir.
export const WORK_ITEM_TEMPLATES: {
  key: string;
  name: string;
  unit: keyof typeof UNITS;
  checked?: boolean;
}[] = [
  { key: "kazi", name: "Kazı (her cins zemin)", unit: "m3", checked: true },
  { key: "kaya", name: "Kaya kazısı", unit: "m3" },
  {
    key: "dolgu",
    name: "Dolgu serme ve sıkıştırma",
    unit: "m3",
    checked: true,
  },
  { key: "nakliye", name: "Hafriyat nakliyesi", unit: "sefer", checked: true },
  { key: "siyirma", name: "Bitkisel toprak sıyırma", unit: "m2" },
  {
    key: "stabilize",
    name: "Stabilize (alt temel) serme",
    unit: "m3",
    checked: true,
  },
  { key: "plentmiks", name: "Plent-miks temel", unit: "m3" },
  { key: "asfalt", name: "Sıcak asfalt", unit: "ton" },
  { key: "sathi", name: "Sathi kaplama", unit: "m2" },
  { key: "bordur", name: "Bordür döşeme", unit: "m" },
  { key: "boru", name: "Boru / menfez döşeme", unit: "m" },
  { key: "makine", name: "İş makinesi çalışması", unit: "saat" },
];

export type ParsedVehicle = {
  plate: string;
  vehicle_type: string;
  capacity_ton: number | null;
  ownership: "own" | "rented" | "subcontractor";
  daily_rate: number | null;
};

// "kiralık 9000", "taşeron", "öz mal" → mülkiyet ve isteğe bağlı günlük kira
function parseOwnership(
  text: string,
): { ownership: ParsedVehicle["ownership"]; daily_rate: number | null } | null {
  const t = text.toLocaleLowerCase("tr-TR").trim();
  const m =
    /^(kiralık|kiralik|taşeron|taseron|öz mal|öz|oz)\s*([\d.,\s]*)(tl)?$/.exec(
      t,
    );
  if (!m) return null;
  const ownership = m[1].startsWith("kira")
    ? "rented"
    : m[1].startsWith("ta")
      ? "subcontractor"
      : "own";
  const rate = m[2].trim() ? parseTrNumber(m[2]) : null;
  return { ownership, daily_rate: rate !== null && rate >= 0 ? rate : null };
}

// Kullanıcının alt alta yazdığı araçlar:
//   06 ABC 123
//   34ŞĞ1234, Damperli kamyon, 25
//   EKS-01; Ekskavatör
// Satır başına bir araç; virgül, noktalı virgül veya sekme ile ayrılmış tür ve kapasite (ton) isteğe bağlı.
export function parseVehicleLines(text: string): {
  vehicles: ParsedVehicle[];
  errors: string[];
} {
  const vehicles: ParsedVehicle[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    // Sekme veya noktalı virgül varsa ayraç odur; yoksa virgül. Kapasite "18,5" gibi
    // ondalık virgül içerebileceği için ikinci ayraçtan sonrası olduğu gibi kapasite sayılır.
    const sep = /[;\t]/.test(raw) ? /[;\t]/ : /,/;
    const parts = raw.split(sep);
    const platePart = parts[0]?.trim();
    const typePart = parts[1]?.trim();
    // Son sütun "kiralık 9000" gibi mülkiyetse ayrılır; aradaki kısım kapasite
    const lastOwnership =
      parts.length >= 3 ? parseOwnership(parts[parts.length - 1]) : null;
    const capPart = parts
      .slice(2, lastOwnership ? -1 : undefined)
      .join(",")
      .trim();
    const plate = normalizePlate(platePart ?? "");
    if (plate.length < 2 || plate.length > 20) {
      errors.push(`${i + 1}. satır: plaka okunamadı`);
      return;
    }
    let capacity: number | null = null;
    if (capPart) {
      capacity = parseTrNumber(capPart.replace(/\s*(ton|t)$/i, "").trim());
      if (capacity === null || capacity <= 0 || capacity > 999_999) {
        errors.push(`${i + 1}. satır: kapasite geçersiz`);
        return;
      }
    }
    if (seen.has(plate)) return; // aynı plaka iki kez yazılmış
    seen.add(plate);
    vehicles.push({
      plate,
      vehicle_type: typePart || "Kamyon",
      capacity_ton: capacity,
      ownership: lastOwnership?.ownership ?? "own",
      daily_rate: lastOwnership?.daily_rate ?? null,
    });
  });

  if (vehicles.length > 100)
    errors.push("Tek seferde en fazla 100 araç eklenebilir");
  return { vehicles, errors };
}
