// İşlem geçmişi: audit_log satırlarını "kim, neyi, nasıl değiştirdi" cümlesine çevirir.
// Saf fonksiyonlar; ekran ve testler aynı kuralı kullanır.

import { formatDateTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";

export type AuditEntry = {
  id: number;
  table_name: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
  changed_by_email: string | null;
};

// Ekrandaki süzgeç: bir başlık birden çok tabloyu kapsayabilir (ücretler)
export const AUDIT_GROUPS: Record<string, { label: string; tables: string[] }> =
  {
    sefer: { label: "Seferler", tables: ["trip_entries"] },
    imalat: { label: "İmalat", tables: ["production_entries"] },
    makine: { label: "Makine saati / mazot", tables: ["machine_logs"] },
    gider: { label: "Giderler", tables: ["expenses"] },
    ucret: {
      label: "Ücretler",
      tables: [
        "work_item_price_history",
        "route_price_history",
        "vehicle_rate_history",
      ],
    },
    tanim: {
      label: "Şantiye, iş kalemi, güzergâh, araç",
      tables: ["sites", "work_items", "routes", "vehicles"],
    },
    kullanici: {
      label: "Kullanıcılar ve firma",
      tables: ["memberships", "invite_codes", "tenants"],
    },
    fotograf: { label: "Fotoğraflar", tables: ["photos"] },
  };

const TABLES: Record<string, string> = {
  trip_entries: "Sefer",
  production_entries: "İmalat",
  machine_logs: "Makine kaydı",
  expenses: "Gider",
  work_item_price_history: "Birim fiyat",
  route_price_history: "Sefer ücreti",
  vehicle_rate_history: "Araç kirası",
  work_item_prices: "Güncel birim fiyat",
  route_prices: "Güncel sefer ücreti",
  vehicle_rates: "Güncel araç kirası",
  sites: "Şantiye",
  work_items: "İş kalemi",
  routes: "Güzergâh",
  vehicles: "Araç",
  memberships: "Kullanıcı yetkisi",
  invite_codes: "Davet kodu",
  tenants: "Firma",
  photos: "Fotoğraf",
};

const ACTIONS: Record<string, string> = {
  INSERT: "eklendi",
  UPDATE: "değiştirildi",
  DELETE: "silindi",
};

const FIELDS: Record<string, string> = {
  entry_date: "Tarih",
  log_date: "Tarih",
  expense_date: "Tarih",
  trip_count: "Sefer",
  tonnage: "Ton",
  quantity: "Miktar",
  hours: "Saat",
  fuel_liters: "Mazot (L)",
  operator: "Operatör",
  note: "Not",
  amount: "Tutar",
  vat_rate: "KDV %",
  category: "Kategori",
  supplier: "Firma",
  description: "Açıklama",
  unit_price: "Birim fiyat",
  trip_price: "Sefer ücreti",
  hourly_rate: "Saatlik ücret",
  daily_rate: "Günlük kira",
  valid_from: "Geçerlilik",
  plate: "Plaka",
  vehicle_type: "Tür",
  kind: "Cinsi",
  ownership: "Mülkiyet",
  capacity_ton: "Kapasite (t)",
  fuel_norm_lph: "Yakıt normu",
  contractor_name: "Taşeron",
  active: "Aktif",
  name: "Ad",
  code: "Kod",
  unit: "Birim",
  planned_quantity: "Planlanan",
  status: "Durum",
  employer: "İşveren",
  location: "Yer",
  start_date: "Başlangıç",
  end_date: "Bitiş",
  locked_until: "Kilit",
  day_start_hour: "İş günü başlangıcı",
  cycle_minutes: "Sefer süresi (dk)",
  distance_km: "Mesafe (km)",
  origin: "Nereden",
  destination: "Nereye",
  role: "Rol",
  label: "Etiket",
  revoked: "İptal",
  plan_status: "Abonelik",
  paid_until: "Ödendiği tarih",
  vehicle_id: "Araç",
  route_id: "Güzergâh",
  work_item_id: "İş kalemi",
  site_id: "Şantiye",
};

// Gösterilmeyen teknik alanlar
const HIDDEN = new Set([
  "id",
  "tenant_id",
  "created_at",
  "created_by",
  "updated_at",
  "client_request_id",
  "activated_at",
  "payment_notified_at",
  "user_id",
  "uses",
  "storage_path",
]);

const ROLES: Record<string, string> = {
  owner: "firma sahibi",
  manager: "yönetici",
  field: "saha personeli",
};
const DATE_FIELDS = new Set([
  "entry_date",
  "log_date",
  "expense_date",
  "valid_from",
  "start_date",
  "end_date",
  "locked_until",
  "paid_until",
]);
const MONEY_FIELDS = new Set([
  "amount",
  "unit_price",
  "trip_price",
  "hourly_rate",
  "daily_rate",
]);

export function formatValue(
  field: string,
  value: unknown,
  names: Map<string, string> = new Map(),
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "evet" : "hayır";
  if (field === "role") return ROLES[String(value)] ?? String(value);
  if (DATE_FIELDS.has(field)) return formatDateTR(String(value));
  if (field.endsWith("_id")) return names.get(String(value)) ?? "—";
  if (typeof value === "number" || /^-?\d+(\.\d+)?$/.test(String(value))) {
    const n = formatTrNumber(Number(value));
    return MONEY_FIELDS.has(field) ? `${n} TL` : n;
  }
  return String(value);
}

export type AuditLine = {
  title: string; // "Sefer silindi"
  who: string; // değiştirenin e-postası
  details: string[]; // "Saat: 8 → 9,5" ya da "Plaka: 34 AB 123"
};

// Eklenen/silinen kayıtta öne çıkan alanlar (tablo başına)
const SUMMARY: Record<string, string[]> = {
  trip_entries: [
    "entry_date",
    "vehicle_id",
    "trip_count",
    "tonnage",
    "route_id",
  ],
  production_entries: ["entry_date", "work_item_id", "quantity", "note"],
  machine_logs: ["log_date", "vehicle_id", "hours", "fuel_liters"],
  expenses: ["expense_date", "category", "amount", "description"],
  work_item_price_history: ["work_item_id", "unit_price", "valid_from"],
  route_price_history: ["route_id", "trip_price", "valid_from"],
  vehicle_rate_history: [
    "vehicle_id",
    "hourly_rate",
    "daily_rate",
    "valid_from",
  ],
  vehicles: ["plate", "vehicle_type"],
  routes: ["name"],
  work_items: ["name", "unit"],
  sites: ["name"],
  memberships: ["role"],
  invite_codes: ["role", "label"],
  photos: ["kind", "taken_on"],
};

export function describeAudit(
  e: AuditEntry,
  names: Map<string, string> = new Map(),
): AuditLine {
  const title = `${TABLES[e.table_name] ?? e.table_name} ${ACTIONS[e.action] ?? e.action}`;
  const who = e.changed_by_email ?? "sistem";
  const label = (f: string) => FIELDS[f] ?? f;
  let details: string[];
  if (e.action === "UPDATE" && e.old_data && e.new_data) {
    const o = e.old_data;
    const n = e.new_data;
    details = Object.keys(n)
      .filter(
        (k) =>
          !HIDDEN.has(k) &&
          JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null),
      )
      .map(
        (k) =>
          `${label(k)}: ${formatValue(k, o[k], names)} → ${formatValue(k, n[k], names)}`,
      );
  } else {
    const row = (e.new_data ?? e.old_data ?? {}) as Record<string, unknown>;
    details = (SUMMARY[e.table_name] ?? [])
      .filter((k) => row[k] !== null && row[k] !== undefined && row[k] !== "")
      .map((k) => `${label(k)}: ${formatValue(k, row[k], names)}`);
  }
  return { title, who, details };
}
