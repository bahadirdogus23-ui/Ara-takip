import { z } from "zod";

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
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Geçerli bir tarih girin")
  .transform((v) => (v === "" ? null : v));

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi girin")),
  password: z.string().min(1, "Şifrenizi girin"),
});

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi girin")),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(72, "Şifre en fazla 72 karakter olabilir"),
});

export const tenantSchema = z.object({
  name: z.string().trim().min(2, "Firma adı en az 2 karakter olmalı").max(200, "Firma adı çok uzun"),
});

export const SITE_STATUSES = {
  active: "Devam ediyor",
  paused: "Durduruldu",
  completed: "Tamamlandı",
} as const;

export const siteSchema = z
  .object({
    name: z.string().trim().min(2, "Şantiye adı en az 2 karakter olmalı").max(200, "Şantiye adı çok uzun"),
    code: optionalText(50),
    employer: optionalText(200),
    location: optionalText(200),
    start_date: optionalDate,
    end_date: optionalDate,
    status: z.enum(["active", "paused", "completed"], "Geçerli bir durum seçin"),
  })
  .refine((s) => !s.start_date || !s.end_date || s.end_date >= s.start_date, {
    path: ["end_date"],
    message: "Bitiş tarihi başlangıçtan önce olamaz",
  });

export type FieldErrors = Record<string, string>;

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
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
