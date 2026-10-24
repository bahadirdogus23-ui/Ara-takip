import ExcelJS from "exceljs";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Kabul testleri K1–K8 (docs/01-mimari-plan.md, bölüm 8)
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const owner = { email: `sahip-${run}@hafriyol.local`, password: "Sifre-12345" };
const field = { email: `saha-${run}@hafriyol.local`, password: "Sifre-12345" };
const other = { email: `rakip-${run}@hafriyol.local`, password: "Sifre-12345" };
let siteUrl = "";

async function signUp(page: Page, user: { email: string; password: string }) {
  await page.goto("/kayit");
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await page.waitForURL("**/firma-olustur");
}

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/giris");
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/(panel|firma-olustur)/);
}

async function createTenant(page: Page, name: string) {
  await page.locator("#name").fill(name);
  await page.getByRole("button", { name: "Firmayı oluştur" }).click();
  await page.waitForURL("**/panel");
}

// SCREENSHOT_DIR verilirse önemli ekranların görüntüsü kaydedilir
async function shot(page: Page, name: string) {
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${page.url()} yatay kaydırma yapıyor`).toBeLessThanOrEqual(0);
}

async function newPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  return context.newPage();
}

test("K1: kayıt olur, firma oluşturur, panele düşer", async ({ page }) => {
  await signUp(page, owner);
  await createTenant(page, "Test Hafriyat Ltd. Şti.");
  await expect(page.getByText("Test Hafriyat Ltd. Şti.")).toBeVisible();
  await expect(page.getByRole("link", { name: "İlk şantiyeyi ekle" })).toBeVisible();
});

test("K4: boş/hatalı form Türkçe hata verir, kayıt oluşmaz", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/santiyeler/yeni");
  await page.locator("#name").fill("a");
  await page.locator("#start_date").fill("2026-05-02");
  await page.locator("#end_date").fill("2026-05-01");
  await page.getByRole("button", { name: "Şantiyeyi ekle" }).click();
  await expect(page.getByText("Şantiye adı en az 2 karakter olmalı")).toBeVisible();
  await expect(page.getByText("Bitiş tarihi başlangıçtan önce olamaz")).toBeVisible();
  await page.goto("/santiyeler");
  await expect(page.getByText("Henüz şantiye yok.")).toBeVisible();
});

test("K2: şantiye, iki iş kalemi ve bir araç tanımlar", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/santiyeler/yeni");
  await page.locator("#name").fill("Çevre Yolu 1. Kısım");
  await page.locator("#employer").fill("Karayolları");
  await page.getByRole("button", { name: "Şantiyeyi ekle" }).click();
  await page.waitForURL(/\/santiyeler\/[0-9a-f-]{36}\?kaydedildi=1/);
  siteUrl = new URL(page.url()).pathname;

  for (const [code, name, unit, price] of [
    ["15.150.1001", "Kazı (yumuşak toprak)", "m3", "85,50"],
    ["", "Stabilize serme", "m2", "12,00"],
  ]) {
    await page.locator("#wi-new-code").fill(code);
    await page.locator("#wi-new-name").fill(name);
    await page.locator("#wi-new-unit").selectOption(unit);
    await page.locator("#wi-new-unit_price").fill(price);
    await page.getByRole("button", { name: "İş kalemi ekle" }).click();
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    await expect(page.locator("#wi-new-name")).toHaveValue("");
  }
  await expect(page.getByText("₺85,50 / m³")).toBeVisible();
  await shot(page, "santiye");

  await page.goto("/araclar");
  await page.locator("#vh-new-plate").fill("06abc123");
  await page.locator("#vh-new-vehicle_type").fill("Kamyon");
  await page.locator("#vh-new-capacity_ton").fill("25");
  await page.getByRole("button", { name: "Araç ekle" }).click();
  await expect(page.getByText("06 ABC 123")).toBeVisible();
});

test("K3 + K5: telefonda hızlı imalat girişi, çift tıklamada tek kayıt", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/gunluk");
  await expectNoHorizontalScroll(page);

  const started = Date.now();
  await page.locator("#pr-work_item_id").selectOption({ label: "15.150.1001 · Kazı (yumuşak toprak) (m³)" });
  await page.locator("#pr-quantity").fill("120,5");
  await page.getByRole("button", { name: "İmalatı kaydet" }).dblclick();
  await expect(page.getByText("İmalat kaydedildi")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(30_000);

  // Kalem seçili kalır, miktar boşalır: ikinci kayıt hemen girilebilir
  await expect(page.locator("#pr-work_item_id")).not.toHaveValue("");
  await expect(page.locator("#pr-quantity")).toHaveValue("");
  await page.locator("#pr-quantity").fill("79,5");
  await page.getByRole("button", { name: "İmalatı kaydet" }).click();
  await expect(page.getByText("İmalat (2)")).toBeVisible();

  await page.locator("#tr-vehicle_id").selectOption({ index: 1 });
  await page.locator("#tr-trip_count").fill("12");
  await page.locator("#tr-tonnage").fill("290");
  await page.getByRole("button", { name: "Seferi kaydet" }).click();
  await expect(page.getByText("12 sefer, 1 kayıt")).toBeVisible();
  await shot(page, "gunluk-giris");

  for (const path of ["/panel", "/kayitlar", "/giderler", "/rapor", "/araclar", siteUrl]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});

test("K7: dönem raporu ve Excel toplamları doğru", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/giderler");
  for (const [category, amount, item] of [
    ["fuel", "3.000,00", "15.150.1001 · Kazı (yumuşak toprak)"],
    ["labor", "1.234,56", ""],
  ]) {
    await page.locator("#ex-category").selectOption(category);
    await page.locator("#ex-amount").fill(amount);
    if (item) await page.locator("#ex-work_item_id").selectOption({ label: item });
    await page.getByRole("button", { name: "Gideri kaydet" }).click();
    await expect(page.getByText("Gider kaydedildi")).toBeVisible();
  }
  await page.goto("/giderler");
  await expect(page.getByText("₺5.081,47")).toBeVisible(); // KDV dahil toplam

  await page.goto("/rapor");
  // 200 m³ × 85,50 = 17.100,00; birim maliyet 3.000 ÷ 200 = 15,00; fark 17.100 − 4.234,56
  await expect(page.getByText("₺17.100,00").first()).toBeVisible();
  await expect(page.getByText("Birim maliyet: ₺15,00")).toBeVisible(); // telefon kart görünümü
  await expect(page.getByText("₺12.865,44")).toBeVisible();
  await shot(page, "rapor");

  const href = await page.getByRole("link", { name: "Excel indir" }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()).buffer as ArrayBuffer);
  expect(wb.getWorksheet("Özet")!.getCell("B7").value).toBe(17100);
  expect(wb.getWorksheet("İmalat")!.getCell("F2").value).toBe(17100);

  const pdf = await page.request.get((await page.getByRole("link", { name: "PDF indir" }).getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("K6: saha personeli giderleri ve raporu göremez", async ({ page, browser }) => {
  const fieldPage = await newPage(browser);
  await signUp(fieldPage, field);

  await signIn(page, owner);
  await page.goto("/kullanicilar");
  await page.locator("#mb-email").fill(field.email.toUpperCase());
  await page.locator("#mb-role").selectOption("field");
  await page.getByRole("button", { name: "Kullanıcı ekle" }).click();
  await expect(page.getByText(`${field.email} eklendi`)).toBeVisible();

  await page.goto("/panel");
  await shot(page, "panel");
  await fieldPage.goto("/panel");
  await expect(fieldPage.getByText("Test Hafriyat Ltd. Şti.")).toBeVisible();
  const nav = fieldPage.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Günlük giriş" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Giderler" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Rapor" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Kullanıcılar" })).toHaveCount(0);

  await fieldPage.goto("/giderler");
  await fieldPage.waitForURL("**/panel");
  const siteId = siteUrl.split("/").pop()!;
  expect((await fieldPage.request.get(`/rapor/excel?santiye=${siteId}`)).status()).toBe(403);

  // Saha personeli imalat girebilir, ama sahibin kaydını silemez
  await fieldPage.goto("/gunluk");
  await expect(fieldPage.getByText("İmalat (2)")).toBeVisible();
  await expect(fieldPage.getByRole("button", { name: "Sil" })).toHaveCount(0);
  await fieldPage.locator("#pr-work_item_id").selectOption({ index: 1 });
  await fieldPage.locator("#pr-quantity").fill("5");
  await fieldPage.getByRole("button", { name: "İmalatı kaydet" }).click();
  await expect(fieldPage.getByText("İmalat (3)")).toBeVisible();
  await expect(fieldPage.getByRole("button", { name: "Sil" })).toHaveCount(1);
  await fieldPage.context().close();
});

test("K8: başka firma hiçbir veriyi göremez", async ({ browser }) => {
  const page = await newPage(browser);
  await signUp(page, other);
  await createTenant(page, "Rakip İnşaat AŞ");

  await expect(page.getByText("Test Hafriyat")).toHaveCount(0);
  await page.goto(siteUrl);
  await expect(page.getByText("Sayfa bulunamadı")).toBeVisible();
  await page.goto("/kayitlar");
  await expect(page.getByText("Bu aralıkta imalat kaydı yok.")).toBeVisible();
  await page.goto("/giderler");
  await expect(page.getByText("Bu aralıkta gider yok.")).toBeVisible();

  const siteId = siteUrl.split("/").pop()!;
  expect((await page.request.get(`/rapor/excel?santiye=${siteId}`)).status()).toBe(404);
  // Adres çubuğuna başka firmanın şantiyesini yazmak raporu açmaz, kendi (boş) verisine döner
  await page.goto(`/rapor?santiye=${siteId}`);
  await expect(page.getByText("Çevre Yolu 1. Kısım")).toHaveCount(0);
  await page.context().close();
});
