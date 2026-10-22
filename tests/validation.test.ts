import { describe, expect, it } from "vitest";
import { signUpSchema, siteSchema, tenantSchema, toFieldErrors } from "@/lib/validation";

const site = (over: Record<string, string> = {}) => ({
  name: "Çevre Yolu 1. Kısım",
  code: "",
  employer: "",
  location: "",
  start_date: "",
  end_date: "",
  status: "active",
  ...over,
});

describe("şantiye doğrulama", () => {
  it("boş isteğe bağlı alanları null yapar", () => {
    const r = siteSchema.parse(site());
    expect(r).toMatchObject({ code: null, employer: null, start_date: null, end_date: null });
  });

  it("baştaki/sondaki boşlukları temizler", () => {
    expect(siteSchema.parse(site({ name: "  Kanal Hattı  " })).name).toBe("Kanal Hattı");
  });

  it("çok kısa adı Türkçe mesajla reddeder", () => {
    const r = siteSchema.safeParse(site({ name: " a " }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r.error!).name).toBe("Şantiye adı en az 2 karakter olmalı");
  });

  it("bitiş tarihi başlangıçtan önce olamaz", () => {
    const r = siteSchema.safeParse(site({ start_date: "2026-05-01", end_date: "2026-04-30" }));
    expect(r.success).toBe(false);
    expect(toFieldErrors(r.error!).end_date).toBe("Bitiş tarihi başlangıçtan önce olamaz");
  });

  it("aynı gün başlayıp biten şantiyeyi kabul eder", () => {
    expect(siteSchema.safeParse(site({ start_date: "2026-05-01", end_date: "2026-05-01" })).success).toBe(true);
  });

  it("geçersiz tarih ve durumu reddeder", () => {
    const r = siteSchema.safeParse(site({ start_date: "01.05.2026", status: "silindi" }));
    expect(r.success).toBe(false);
    const e = toFieldErrors(r.error!);
    expect(e.start_date).toBe("Geçerli bir tarih girin");
    expect(e.status).toBe("Geçerli bir durum seçin");
  });
});

describe("hesap ve firma doğrulama", () => {
  it("e-postayı küçük harfe çevirir", () => {
    expect(signUpSchema.parse({ email: " Ali@Firma.COM ", password: "12345678" }).email).toBe("ali@firma.com");
  });

  it("8 karakterden kısa şifreyi reddeder", () => {
    const r = signUpSchema.safeParse({ email: "a@b.co", password: "1234567" });
    expect(toFieldErrors(r.error!).password).toBe("Şifre en az 8 karakter olmalı");
  });

  it("boş firma adını reddeder", () => {
    expect(tenantSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});
