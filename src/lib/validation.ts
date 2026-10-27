import { z } from "zod";
import { decimalPlaces, parseTrNumber } from "@/lib/number";

// Formlardan gelen boş metni null'a çevirir (veritabanında "boş" = null).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir`)
    .transform((v) => (v === "" ? null : v));

const optionalDate = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v),
    "Geçerli bir tarih girin",
  )
  .transform((v) => (v === "" ? null : v));

const uuid = (message: string) => z.string().trim().pipe(z.uuid(message));

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin");

type NumberOpts = {
  label: string;
  decimals: number;
  min?: number;
  minExclusive?: boolean;
  max: number;
};

// Türkçe yazılmış sayıyı (ör. "1.234,5") doğrular ve sayıya çevirir.
// optional: boş giriş hata değil, null döner.
function trNumberField(
  { label, decimals, min = 0, minExclusive = false, max }: NumberOpts,
  optional: boolean,
) {
  return z
    .string()
    .optional()
    .transform((input, ctx): number | null => {
      const raw = input ?? "";
      if (optional && raw.trim() === "") return null;
      const n = parseTrNumber(raw);
      const fail = (message: string) => {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      };
      if (n === null)
        return fail(
          raw.trim() === ""
            ? `${label} girin`
            : `${label} için geçerli bir sayı girin`,
        );
      if (minExclusive ? n <= min : n < min)
        return fail(
          minExclusive
            ? `${label} ${min}'dan büyük olmalı`
            : `${label} negatif olamaz`,
        );
      if (n > max) return fail(`${label} çok büyük`);
      if (decimalPlaces(n) > decimals) {
        return fail(
          decimals === 0
            ? `${label} tam sayı olmalı`
            : `${label} en fazla ${decimals} ondalık basamak olabilir`,
        );
      }
      return n;
    });
}

const trNumber = (opts: NumberOpts) =>
  trNumberField(opts, false).pipe(z.number());
const optionalTrNumber = (opts: NumberOpts) => trNumberField(opts, true);

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Geçerli bir e-posta adresi girin")),
  password: z.string().min(1, "Şifrenizi girin"),
});

export const resetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Geçerli bir e-posta adresi girin")),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Şifre en az 8 karakter olmalı")
      .max(72, "Şifre en fazla 72 karakter olabilir"),
    password_again: z.string(),
  })
  .refine((v) => v.password === v.password_again, {
    path: ["password_again"],
    message: "Şifreler aynı değil",
  });

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Geçerli bir e-posta adresi girin")),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .max(72, "Şifre en fazla 72 karakter olabilir"),
});

export const tenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Firma adı en az 2 karakter olmalı")
    .max(200, "Firma adı çok uzun"),
});

export const SITE_STATUSES = {
  active: "Devam ediyor",
  paused: "Durduruldu",
  completed: "Tamamlandı",
} as const;

// Şantiyenin iş günü başlangıç saati seçenekleri (gece vardiyası için)
export const DAY_START_HOURS = [0, 4, 5, 6, 7, 8] as const;

export const siteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Şantiye adı en az 2 karakter olmalı")
      .max(200, "Şantiye adı çok uzun"),
    code: optionalText(50),
    employer: optionalText(200),
    location: optionalText(200),
    start_date: optionalDate,
    end_date: optionalDate,
    status: z.enum(
      ["active", "paused", "completed"],
      "Geçerli bir durum seçin",
    ),
    day_start_hour: z
      .enum(DAY_START_HOURS.map(String) as [string, ...string[]], {
        message: "Geçerli bir saat seçin",
      })
      .optional()
      .transform((v) => Number(v ?? 0)),
  })
  .refine((s) => !s.start_date || !s.end_date || s.end_date >= s.start_date, {
    path: ["end_date"],
    message: "Bitiş tarihi başlangıçtan önce olamaz",
  });

export const UNITS = {
  m: "m",
  m2: "m²",
  m3: "m³",
  ton: "ton",
  kg: "kg",
  adet: "adet",
  lt: "lt",
  km: "km",
  saat: "saat",
  gun: "gün",
  sefer: "sefer",
} as const;

export const workItemSchema = z.object({
  code: optionalText(50),
  name: z
    .string()
    .trim()
    .min(2, "İş kalemi adı en az 2 karakter olmalı")
    .max(300, "İş kalemi adı çok uzun"),
  unit: z.enum(Object.keys(UNITS) as [keyof typeof UNITS], "Birim seçin"),
  unit_price: optionalTrNumber({
    label: "Birim fiyat",
    decimals: 2,
    max: 999_999_999_999,
  }),
  planned_quantity: optionalTrNumber({
    label: "Planlanan miktar",
    decimals: 3,
    max: 9_999_999_999_999,
  }),
});

export const routeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Güzergâh adı en az 2 karakter olmalı")
    .max(200, "Güzergâh adı çok uzun"),
  origin: optionalText(200),
  destination: optionalText(200),
  distance_km: optionalTrNumber({ label: "Mesafe", decimals: 2, max: 999_999 }),
  cycle_minutes: optionalTrNumber({
    label: "Çevrim süresi",
    decimals: 0,
    min: 0,
    minExclusive: true,
    max: 1440,
  }),
  trip_price: optionalTrNumber({
    label: "Sefer ücreti",
    decimals: 2,
    max: 9_999_999,
  }),
  work_item_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "İş kalemi seçin"),
});

export const VEHICLE_KIND = {
  kamyon: "Kamyon (sefer yapar)",
  is_makinesi: "İş makinesi (saat / mazot)",
  diger: "Diğer",
} as const;

export const VEHICLE_OWNERSHIP = {
  own: "Öz mal",
  rented: "Kiralık",
  subcontractor: "Taşeron",
} as const;

// "06abc123" / "06 ABC 123" → "06 ABC 123"
export function normalizePlate(raw: string): string {
  const s = raw.toLocaleUpperCase("tr-TR").replace(/[^0-9A-ZÇĞİÖŞÜ]/g, "");
  const m = /^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,5})$/.exec(s);
  return m
    ? `${m[1]} ${m[2]} ${m[3]}`
    : raw.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
}

export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(2, "Plaka / makine no girin")
    .max(20, "Plaka çok uzun")
    .transform(normalizePlate),
  vehicle_type: z
    .string()
    .trim()
    .min(2, "Araç türünü girin")
    .max(100, "Araç türü çok uzun"),
  // Boşsa türden tahmin edilir (guessVehicleKind)
  kind: z
    .enum(["kamyon", "is_makinesi", "diger", ""], "Araç cinsini seçin")
    .optional()
    .transform((v) => v || null),
  ownership: z.enum(["own", "rented", "subcontractor"], "Mülkiyet seçin"),
  capacity_ton: optionalTrNumber({
    label: "Kapasite",
    decimals: 2,
    min: 0,
    minExclusive: true,
    max: 999_999,
  }),
  fuel_norm_lph: optionalTrNumber({
    label: "Yakıt normu",
    decimals: 2,
    min: 0,
    minExclusive: true,
    max: 9_999,
  }),
  contractor_name: optionalText(200)
    .optional()
    .transform((v) => v ?? null),
  hourly_rate: optionalTrNumber({
    label: "Saatlik ücret",
    decimals: 2,
    max: 9_999_999,
  }),
  daily_rate: optionalTrNumber({
    label: "Günlük kira",
    decimals: 2,
    max: 9_999_999,
  }),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const productionSchema = z.object({
  site_id: uuid("Şantiye seçin"),
  work_item_id: uuid("İş kalemi seçin"),
  entry_date: requiredDate,
  quantity: trNumber({
    label: "Miktar",
    decimals: 3,
    min: 0,
    minExclusive: true,
    max: 9_999_999_999_999,
  }),
  note: optionalText(500),
  client_request_id: uuid("Form süresi doldu, sayfayı yenileyin"),
});

export const tripSchema = z.object({
  site_id: uuid("Şantiye seçin"),
  vehicle_id: uuid("Araç seçin"),
  route_id: z.union([
    z.literal("").transform(() => null),
    uuid("Güzergâh seçin"),
  ]),
  entry_date: requiredDate,
  trip_count: trNumber({
    label: "Sefer sayısı",
    decimals: 0,
    min: 0,
    minExclusive: true,
    max: 500,
  }),
  tonnage: optionalTrNumber({ label: "Tonaj", decimals: 3, max: 999_999_999 }),
  note: optionalText(500),
  client_request_id: uuid("Form süresi doldu, sayfayı yenileyin"),
});

export const machineLogSchema = z
  .object({
    site_id: uuid("Şantiye seçin"),
    vehicle_id: uuid("Makine seçin"),
    log_date: requiredDate,
    hours: optionalTrNumber({
      label: "Çalışma saati",
      decimals: 2,
      min: 0,
      minExclusive: true,
      max: 24,
    }),
    fuel_liters: optionalTrNumber({
      label: "Mazot",
      decimals: 2,
      min: 0,
      minExclusive: true,
      max: 5000,
    }),
    operator: optionalText(100),
    note: optionalText(500),
    client_request_id: uuid("Form süresi doldu, sayfayı yenileyin"),
  })
  .refine((m) => m.hours !== null || m.fuel_liters !== null, {
    path: ["hours"],
    message: "Çalışma saati veya mazot girin",
  });

export const EXPENSE_CATEGORIES = {
  fuel: "Mazot / yakıt",
  labor: "İşçilik",
  material: "Malzeme",
  subcontractor: "Taşeron",
  equipment_rent: "Makine kirası",
  maintenance: "Bakım / onarım",
  other: "Diğer",
} as const;

export const VAT_RATES = ["0", "1", "10", "20"] as const;

export const expenseSchema = z.object({
  site_id: uuid("Şantiye seçin"),
  work_item_id: z.union([
    z.literal("").transform(() => null),
    uuid("İş kalemi seçin"),
  ]),
  expense_date: requiredDate,
  category: z.enum(
    Object.keys(EXPENSE_CATEGORIES) as [keyof typeof EXPENSE_CATEGORIES],
    "Gider türü seçin",
  ),
  amount: trNumber({
    label: "Tutar",
    decimals: 2,
    min: 0,
    minExclusive: true,
    max: 999_999_999_999,
  }),
  vat_rate: z.enum(VAT_RATES, "KDV oranı seçin").transform(Number),
  supplier: optionalText(200),
  description: optionalText(500),
  client_request_id: uuid("Form süresi doldu, sayfayı yenileyin"),
});

// Davet kodu: büyük/küçük harf, tire ve boşluk fark etmez ("k7mq 2xpa" → "K7MQ2XPA")
export const inviteCodeSchema = z.object({
  code: z
    .string()
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^[A-Z2-9]{8}$/, "Kod 8 karakter olmalı (ör. K7MQ-2XPA)"),
    ),
});

export const inviteSchema = z.object({
  role: z.enum(["owner", "manager", "field"], "Rol seçin"),
  label: z.string().trim().max(100, "En fazla 100 karakter").default(""),
  days: z
    .enum(["", "1", "7", "30", "365"])
    .transform((v) => (v ? Number(v) : null)),
  max_uses: z
    .enum(["", "1", "5", "20", "100"])
    .transform((v) => (v ? Number(v) : null)),
});

export const memberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Geçerli bir e-posta adresi girin")),
  role: z.enum(["owner", "manager", "field"], "Rol seçin"),
});

export type FieldErrors = Record<string, string>;

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
  // Başarılı kayıttan sonra formu sıfırlamak için değişen anahtar
  ok?: string;
  message?: string;
} | null;

// FormData → düz nesne (yalnızca metin alanları)
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  });
  return out;
}

// Zod hatalarını alan → ilk mesaj biçimine çevirir
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
