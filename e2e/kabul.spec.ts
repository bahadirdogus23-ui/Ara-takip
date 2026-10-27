import { execSync } from "node:child_process";
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
  await page.waitForURL("**/kurulum");
}

// SCREENSHOT_DIR verilirse önemli ekranların görüntüsü kaydedilir
async function shot(page: Page, name: string) {
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/${name}.png`,
      fullPage: true,
    });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${page.url()} yatay kaydırma yapıyor`).toBeLessThanOrEqual(
    0,
  );
}

async function newPage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  });
  return context.newPage();
}

test("K1: kayıt olur, firma oluşturur, hızlı kuruluma düşer", async ({
  page,
}) => {
  await signUp(page, owner);
  await createTenant(page, "Test Hafriyat Ltd. Şti.");
  await expect(page.getByText("Test Hafriyat Ltd. Şti.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hızlı kurulum" }),
  ).toBeVisible();
  // Kurulumu atlarsa Bugün ekranı onu kuruluma çağırır
  await page.goto("/panel");
  await expect(page.getByRole("link", { name: "Hızlı kurulum" })).toBeVisible();
});

test("K4: boş/hatalı form Türkçe hata verir, kayıt oluşmaz", async ({
  page,
}) => {
  await signIn(page, owner);
  await page.goto("/santiyeler/yeni");
  await page.locator("#name").fill("a");
  await page.locator("#start_date").fill("2026-05-02");
  await page.locator("#end_date").fill("2026-05-01");
  await page.getByRole("button", { name: "Şantiyeyi ekle" }).click();
  await expect(
    page.getByText("Şantiye adı en az 2 karakter olmalı"),
  ).toBeVisible();
  await expect(
    page.getByText("Bitiş tarihi başlangıçtan önce olamaz"),
  ).toBeVisible();
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

test("K3 + K5: telefonda hızlı imalat girişi, çift tıklamada tek kayıt", async ({
  page,
}) => {
  await signIn(page, owner);
  await page.goto("/gunluk");
  await expectNoHorizontalScroll(page);

  const started = Date.now();
  await page
    .locator("#pr-work_item_id")
    .selectOption({ label: "15.150.1001 · Kazı (yumuşak toprak) (m³)" });
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
  await expect(page.getByText("Sefer (12 sefer)")).toBeVisible();
  await shot(page, "gunluk-giris");

  for (const path of [
    "/panel",
    "/kayitlar",
    "/giderler",
    "/rapor",
    "/araclar",
    siteUrl,
  ]) {
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
    if (item)
      await page.locator("#ex-work_item_id").selectOption({ label: item });
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

  const href = await page
    .getByRole("link", { name: "Excel indir" })
    .getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()).buffer as ArrayBuffer);
  expect(wb.getWorksheet("Özet")!.getCell("B7").value).toBe(17100);
  expect(wb.getWorksheet("İmalat")!.getCell("F2").value).toBe(17100);

  const pdf = await page.request.get(
    (await page.getByRole("link", { name: "PDF indir" }).getAttribute("href"))!,
  );
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("K6: saha personeli giderleri ve raporu göremez", async ({
  page,
  browser,
}) => {
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
  await expect(
    fieldPage.getByRole("banner").getByText("Test Hafriyat Ltd. Şti."),
  ).toBeVisible();
  const nav = fieldPage.getByRole("navigation", { name: "Ana menü" });
  await expect(nav.getByRole("link", { name: "Sefer" })).toBeVisible();
  await fieldPage.goto("/menu");
  await expect(
    fieldPage.getByRole("link", { name: "Sefer sayacı" }),
  ).toBeVisible();
  for (const hidden of ["Giderler", "Rapor", "Kullanıcılar"]) {
    await expect(fieldPage.getByRole("link", { name: hidden })).toHaveCount(0);
  }

  await fieldPage.goto("/giderler");
  await fieldPage.waitForURL("**/panel");
  // K17: saha personeli birim fiyat, sefer ücreti ve kira görmez (ekranda da veritabanında da)
  for (const path of [siteUrl, "/araclar", "/panel"]) {
    await fieldPage.goto(path);
    await expect(fieldPage.locator("main")).not.toContainText("₺");
  }
  const siteId = siteUrl.split("/").pop()!;
  expect(
    (await fieldPage.request.get(`/rapor/excel?santiye=${siteId}`)).status(),
  ).toBe(403);

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

test("K9: hızlı kurulum ve tek dokunuşla sefer sayacı", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/kurulum");
  await page.locator("#site_name").fill("Köy Yolu Stabilize");
  await page
    .locator("#vehicles")
    .fill("35 KY 101, Kamyon, 20\n35 KY 102, Kamyon, 18,5\n06 ABC 123");
  await page.getByRole("button", { name: "Kurulumu bitir" }).click();
  await page.waitForURL("**/sefer?hazir=1");
  await expectNoHorizontalScroll(page);
  await expect(page.locator("select").first()).toHaveValue(/.+/);

  const plus = page.getByRole("button", { name: "35 KY 101 +1 sefer" });
  for (let i = 0; i < 3; i++) {
    await plus.click();
    await expect(page.getByLabel(`${i + 1} sefer`).first()).toBeVisible();
  }
  await expect(page.getByText("35 KY 101: sefer kaydedildi")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "35 KY 101 son seferi geri al" })
    .click();
  await expect(page.getByText("son sefer geri alındı")).toBeVisible();
  await expectNoHorizontalScroll(page);
  // Kartlar ekrana sığmalı (yatay kaydırma olmasa bile taşma olabilir)
  for (const box of await page
    .locator("main li.card")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) {
    expect(box).toBeLessThanOrEqual(390);
  }
  await shot(page, "sefer-sayaci");

  // Sayfa yenilenince sunucudaki sayı korunur; 20 t kapasite × 2 sefer = 40 t
  await page.reload();
  await expect(page.getByLabel("2 sefer")).toBeVisible();
  await expect(page.getByText("40", { exact: true })).toBeVisible();

  // Mevcut plaka (06 ABC 123) ikinci kez eklenmez; hazır iş kalemleri şantiyeye eklenir
  await page.goto("/araclar");
  await expect(page.getByText("06 ABC 123", { exact: true })).toHaveCount(1);
  await page.goto("/panel");
  await expect(page.getByText("Bugün sefer")).toBeVisible();
  await shot(page, "bugun");
  await page.goto("/gunluk");
  await expect(
    page.locator("#pr-work_item_id option", {
      hasText: "Stabilize (alt temel) serme",
    }),
  ).toHaveCount(1);
});

test("K10: makine/mazot, şişirilmiş sefer uyarısı ve WhatsApp özeti", async ({
  page,
}) => {
  await signIn(page, owner);

  // Normu 15 L/saat olan bir ekskavatör
  await page.goto("/araclar");
  await page.locator("#vh-new-plate").fill("EKS-01");
  await page.locator("#vh-new-vehicle_type").fill("Ekskavatör");
  await page.locator("#vh-new-fuel_norm_lph").fill("15");
  await page.getByRole("button", { name: "Araç ekle" }).click();
  await expect(page.getByText("norm 15 L/saat")).toBeVisible();

  // Bir seferi 60 dk süren güzergâh: günde en fazla 11 sefer
  await page.goto("/santiyeler");
  await page.getByRole("link", { name: /Köy Yolu Stabilize/ }).click();
  await page.locator("#rt-new-name").fill("Ocak → Km 2");
  await page.locator("#rt-new-cycle_minutes").fill("60");
  await page.getByRole("button", { name: "Güzergâh ekle" }).click();
  await expect(page.getByText("en fazla 11 sefer/gün")).toBeVisible();

  await page.goto("/sefer");
  await page.getByRole("button", { name: "Ocak → Km 2" }).click();
  const plus = page.getByRole("button", { name: "35 KY 102 +1 sefer" });
  for (let i = 1; i <= 12; i++) {
    await plus.click();
    await expect(page.getByLabel(`${i} sefer`).first()).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByText(/Fazla sefer şüphesi · Ocak → Km 2: 12 sefer, en fazla 11/),
  ).toBeVisible();
  // Ekskavatör sefer yapmaz, sayaçta görünmez
  await expect(
    page.getByRole("button", { name: "EKS-01 +1 sefer" }),
  ).toHaveCount(0);
  await shot(page, "sefer-uyari");

  // 10 saatte 190 L = 19 L/saat > 15 × 1,2
  await page.goto("/makine");
  await page
    .locator("#mk-vehicle_id")
    .selectOption({ label: "EKS-01 · Ekskavatör" });
  await page.locator("#mk-hours").fill("10");
  await page.locator("#mk-fuel_liters").fill("190");
  await page.locator("#mk-operator").fill("Ali Usta");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Makine kaydı alındı")).toBeVisible();
  await expect(page.getByText("Norm (15 L/saat) aşıldı")).toBeVisible();
  await expect(page.locator("#mk-operator")).toHaveValue("Ali Usta");
  await expectNoHorizontalScroll(page);

  await page.goto("/panel");
  await expect(page.getByRole("heading", { name: "Dikkat (2)" })).toBeVisible();
  const summary = page.locator("pre");
  await expect(summary).toContainText("35 KY 102: 12 sefer");
  await expect(summary).toContainText("EKS-01: 10 saat, 190 L");
  await expect(summary).not.toContainText("₺");
  const wa = await page
    .getByRole("link", { name: "WhatsApp'a gönder" })
    .getAttribute("href");
  expect(wa).toMatch(/^https:\/\/wa\.me\/\?text=/);
  await expectNoHorizontalScroll(page);
  await shot(page, "bugun-uyari");

  await page.goto("/rapor");
  await expect(page.getByRole("heading", { name: "Makineler" })).toBeVisible();
});

test("K11: internet yokken sefer telefona kaydedilir, bağlantı gelince gönderilir", async ({
  page,
  context,
}) => {
  await signIn(page, owner);
  await page.goto("/sefer");
  // Service worker hazır olsun ve sayfa önbelleğe girsin
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);

  const card = page.locator("li", { hasText: "35 KY 101" });
  const count = async () =>
    Number(
      (await card.getByLabel(/^\d+ sefer$/).getAttribute("aria-label"))!.split(
        " ",
      )[0],
    );
  const before = await count();

  await context.setOffline(true);
  await page.getByRole("button", { name: "35 KY 101 +1 sefer" }).click();
  await page.getByRole("button", { name: "35 KY 101 +1 sefer" }).click();
  await expect(page.getByText("2 sefer telefonda bekliyor")).toBeVisible();
  expect(await count()).toBe(before + 2);
  await shot(page, "cevrimdisi");

  // İnternetsizken sayfa yeniden açılsa da çalışır (önbellekten), bekleyenler korunur
  await page.reload();
  await expect(page.getByText("2 sefer telefonda bekliyor")).toBeVisible();
  expect(await count()).toBe(before + 2);

  await context.setOffline(false);
  await expect(page.getByText("bekleyen 2 sefer gönderildi")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("telefonda bekliyor")).toHaveCount(0);
  await page.reload();
  expect(await count()).toBe(before + 2);
});

test("K16: telefonda bekleyen seferler çıkışta ve sunucu reddinde kaybolmaz", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await signIn(page, owner);
  await page.goto("/sefer");
  const card = page.locator("li", { hasText: "35 KY 101" });
  const count = async () =>
    Number(
      (await card.getByLabel(/^\d+ sefer$/).getAttribute("aria-label"))!.split(
        " ",
      )[0],
    );
  const before = await count();
  const queued = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("hafriyol_kuyruk") ?? "[]").length,
    );

  // Bağlantı kopuk (istekler sunucuya ulaşmıyor): 3 sefer telefona yazılır
  const block = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST" ? route.abort() : route.continue();
  await page.route("**/*", block);
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: "35 KY 101 +1 sefer" }).click();
    await expect.poll(queued).toBe(i);
  }
  // Başka ekrana geçilir, gönderim yine denenir ama bağlantı yok; şerit görünür
  await page.goto("/menu");
  await expect(page.getByText("3 sefer telefonda bekliyor")).toBeVisible();
  await page.unroute("**/*", block);

  // Çıkış uyarır ve kuyruğu silmez
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await page.waitForURL("**/giris");
  expect(dialogs.some((m) => m.includes("3 sefer henüz gönderilmedi"))).toBe(
    true,
  );
  expect(await queued()).toBe(3);

  // Aynı kullanıcı tekrar girince, sayaç ekranına gitmeden gönderilir
  await signIn(page, owner);
  await expect.poll(queued, { timeout: 15_000 }).toBe(0);
  await page.goto("/sefer");
  expect(await count()).toBe(before + 3);

  // Sunucunun kabul etmediği (çok eski) sefer silinmez, "gönderilemeyenler" listesinde görünür
  const [siteId, vehicleId] = execSync(
    "psql -h 127.0.0.1 -p 54339 -U postgres -d postgres -At -v ON_ERROR_STOP=1",
    {
      input: `select te.site_id || '|' || te.vehicle_id from public.trip_entries te join public.vehicles v on v.id = te.vehicle_id
      where v.plate = '35 KY 101' order by te.created_at desc limit 1`,
    },
  )
    .toString()
    .trim()
    .split("|");
  await page.evaluate(
    ([s, v]) =>
      localStorage.setItem(
        "hafriyol_kuyruk",
        JSON.stringify([
          {
            siteId: s,
            vehicleId: v,
            routeId: null,
            requestId: crypto.randomUUID(),
            entryDate: "2025-01-01",
            at: Date.now(),
          },
        ]),
      ),
    [siteId, vehicleId],
  );
  await page.reload();
  await expect(page.getByText("Gönderilemeyen seferler (1)")).toBeVisible();
  await expect(page.getByText(/en fazla 62 gün/)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("hafriyol_gonderilemeyen") ?? "[]")
          .length,
    ),
  ).toBe(1);
  await shot(page, "gonderilemeyen");
});

test("K12: taşeron hakedişi sefer ücretinden hesaplanır", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/araclar");
  const truck = page.locator("li", { hasText: "35 KY 102" });
  await truck.getByText("Düzenle").click();
  await truck.getByLabel("Mülkiyet").selectOption("subcontractor");
  await truck.getByLabel("Taşeron / kiralayan firma").fill("Yılmaz Nakliyat");
  await truck.getByRole("button", { name: "Kaydet" }).click();
  await expect(truck.getByText("Kaydedildi")).toBeVisible();

  await page.goto("/santiyeler");
  await page.getByRole("link", { name: /Köy Yolu Stabilize/ }).click();
  const route = page.locator("li", { hasText: "Ocak → Km 2" });
  await route.getByText("Düzenle").click();
  await route.getByLabel("Taşerona sefer başı ücret (TL)").fill("850");
  await route.getByRole("button", { name: "Kaydet" }).click();
  await expect(route.getByText("Kaydedildi")).toBeVisible();

  // K10'da 35 KY 102 bu güzergâhta 12 sefer yaptı: 12 × 850 = 10.200
  await page.goto("/hakedis");
  const card = page.locator("section", { hasText: "Yılmaz Nakliyat" });
  await expect(card.getByText("₺10.200,00").first()).toBeVisible();
  await expect(card.getByText("Ödemeden önce kontrol edin")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "hakedis");

  const excel = await page.request.get(
    (await page
      .getByRole("link", { name: "Excel indir" })
      .getAttribute("href"))!,
  );
  expect(excel.status()).toBe(200);
});

test("K13: kantar fişi fotoğrafı yüklenir, görüntülenir ve silinir", async ({
  page,
}) => {
  await signIn(page, owner);
  await page.goto("/fotograflar");
  await page.getByRole("radio", { name: "Kantar fişi" }).click();
  await page.getByLabel("Açıklama").fill("Fiş no 4512");
  await page.locator("#photo-input").setInputFiles("public/icons/icon-512.png");
  await expect(page.getByText("Fotoğraf eklendi")).toBeVisible({
    timeout: 20_000,
  });

  const img = page.getByRole("img", { name: "Fiş no 4512" });
  await expect(img).toBeVisible();
  // Görüntü gerçekten yüklenmeli (imzalı adres çalışıyor)
  await expect
    .poll(() =>
      img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(img).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/sign\/photos\//,
  );

  // Bugün ekranında da görünür
  await page.goto("/panel");
  await expect(page.getByRole("img", { name: "Fiş no 4512" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, "bugun-foto");

  // İkinci bir fotoğraf ekle ve sil
  await page.goto("/fotograflar");
  await page.getByRole("radio", { name: "Hasar / arıza" }).click();
  await page.getByLabel("Açıklama").fill("Silinecek");
  await page.locator("#photo-input").setInputFiles("public/icons/icon-192.png");
  await expect(page.getByRole("img", { name: "Silinecek" })).toBeVisible({
    timeout: 20_000,
  });
  page.once("dialog", (d) => d.accept());
  await page
    .locator("li", { has: page.getByRole("img", { name: "Silinecek" }) })
    .getByRole("button", { name: "Sil" })
    .click();
  await expect(page.getByRole("img", { name: "Silinecek" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Fiş no 4512" })).toBeVisible();
});

test("K14: nakliyecinin bir günü (kullanıcı geri bildirimi)", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const page = await newPage(browser);
  page.on("dialog", (d) => d.accept());
  await signUp(page, {
    email: `dogus-${run}@hafriyol.local`,
    password: "Sifre-12345",
  });
  await createTenant(page, "Doğuş Hafriyat Nakliyat");

  // Kurulumda kiralık kamyon ve günlük kirası doğrudan yazılır
  await page.locator("#site_name").fill("Malatya Çevre Yolu Km 12");
  await page
    .locator("#vehicles")
    .fill(
      "44 DH 101, Kamyon, 25\n06 KR 501, Kamyon, 30, kiralık 9000\nEKS-01, Ekskavatör, , kiralık 12000",
    );
  await page.getByRole("button", { name: "Kurulumu bitir" }).click();
  await page.waitForURL("**/sefer?hazir=1");
  // Nakliye işi seçili olduğu için hazır güzergâh açıldı ve seçili
  await expect(
    page.getByRole("button", { name: "Ana güzergâh" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Kantar tonuyla sefer: 2 sefer tonlu, 1 sefer tonsuz
  await page.getByText("Her seferde kantar tonu gir").click();
  for (const ton of ["24,5", "26"]) {
    await page.getByRole("button", { name: "44 DH 101 +1 sefer" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").fill(ton);
    await dialog.getByRole("button", { name: "Seferi kaydet" }).click();
    await expect(
      page.getByText(`44 DH 101: ${ton} t sefer kaydedildi`),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "06 KR 501 +1 sefer" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tonsuz kaydet" })
    .click();
  await expect(page.getByText("06 KR 501: sefer kaydedildi")).toBeVisible();
  await page.reload();
  await expect(
    page.locator("li", { hasText: "44 DH 101" }).getByText("50,5 t"),
  ).toBeVisible();
  await shot(page, "k14-sefer-ton");

  // Kiralık araç düzenleme formu kayıttan sonra hâlâ "Kiralık" göstermeli (hata düzeltmesi)
  await page.goto("/araclar");
  const kr = page.locator("li", { hasText: "06 KR 501" });
  await expect(kr.getByText(/Kiralık/).first()).toBeVisible();
  await kr.getByText("Düzenle").click();
  await expect(kr.getByLabel("Mülkiyet")).toHaveValue("rented");
  await kr.getByLabel("Taşeron / kiralayan firma").fill("Kaya Kiralama");
  await kr.getByRole("button", { name: "Kaydet" }).click();
  await expect(kr.getByText("Kaydedildi")).toBeVisible();
  await expect(kr.getByLabel("Mülkiyet")).toHaveValue("rented");
  await expect(kr.getByLabel("Günlük kira (TL)")).toHaveValue("9000");

  // İşveren birim fiyatı: nakliye seferi 750 TL → seferler imalat tutarına dönüşür
  await page.goto("/santiyeler");
  await page.getByRole("link", { name: /Malatya Çevre Yolu/ }).click();
  const haul = page
    .locator("li", { hasText: "Hafriyat nakliyesi" })
    .filter({ hasNotText: "seferler →" });
  await haul.getByText("Düzenle").click();
  await haul.getByLabel("Birim fiyat (TL)").fill("750");
  await haul.getByRole("button", { name: "Kaydet" }).click();
  await expect(haul.getByText("Kaydedildi")).toBeVisible();
  await expect(page.getByText("seferler → Hafriyat nakliyesi")).toBeVisible();

  // Mazot faturası
  await page.goto("/giderler");
  await page.locator("#ex-category").selectOption("fuel");
  await page.locator("#ex-amount").fill("5.000");
  await page.getByRole("button", { name: "Gideri kaydet" }).click();
  await expect(page.getByText("Gider kaydedildi")).toBeVisible();
  // Kiralık kamyonun bugünkü kirası (1 gün × 9.000) giderlerde kendiliğinden görünür
  await page.goto("/giderler");
  await expect(
    page.getByText("Araç kirası / taşeron (otomatik)"),
  ).toBeVisible();
  const totals = page.locator("section", {
    hasText: "Toplam gider (KDV hariç)",
  });
  await expect(totals.getByText("₺9.000,00")).toBeVisible();
  await expect(totals.getByText("₺14.000,00")).toBeVisible();
  await shot(page, "k14-giderler");

  // Rapor: 3 sefer × 750 = 2.250 gelir; gider 5.000 + 9.000 = 14.000
  await page.goto("/rapor");
  await expect(page.getByText("₺2.250,00").first()).toBeVisible();
  await expect(
    page.getByText("Araç kirası / taşeron (otomatik)"),
  ).toBeVisible();
  await expect(page.getByText("₺14.000,00").first()).toBeVisible();
  await expect(page.getByText("-₺11.750,00").first()).toBeVisible();
  await shot(page, "k14-rapor");

  // Kayıt gir: seferler kamyon başına tek satır
  await page.goto("/gunluk");
  await expect(page.getByText("Sefer (3 sefer)")).toBeVisible();
  await expect(
    page.locator("li", { hasText: "44 DH 101" }).getByText("50,5 t kantar"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Son seferi sil" }),
  ).toHaveCount(2);
  await page.context().close();
});

test("K15: 1200 seferde rapor, hakediş ve kayıtlar eksiksiz (1000 satır sınırı)", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const page = await newPage(browser);
  const u = { email: `filo-${run}@hafriyol.local`, password: "Sifre-12345" };
  const site = `Filo Şantiyesi ${run}`;
  await signUp(page, u);
  await createTenant(page, "Büyük Filo Hafriyat");
  await page.locator("#site_name").fill(site);
  await page
    .locator("#vehicles")
    .fill(
      Array.from(
        { length: 10 },
        (_, i) =>
          `34 FL ${String(i + 1).padStart(3, "0")}, Kamyon, 25, kiralık 9000`,
      ).join("\n"),
    );
  await page.getByRole("button", { name: "Kurulumu bitir" }).click();
  await page.waitForURL("**/sefer?hazir=1");

  // 10 kiralık kamyon × 12 gün × günde 10 dokunuş = 1200 satır (yerel PostgREST de 1000 satırla sınırlı)
  execSync(
    "psql -h 127.0.0.1 -p 54339 -U postgres -d postgres -v ON_ERROR_STOP=1 -q",
    {
      input: `insert into public.trip_entries(tenant_id, site_id, vehicle_id, route_id, entry_date, trip_count, created_by)
      select s.tenant_id, s.id, v.id, r.id, d::date, 1, us.id
      from public.sites s join public.routes r on r.site_id = s.id join public.vehicles v on v.tenant_id = s.tenant_id
      cross join generate_series('2026-01-05'::date, '2026-01-16'::date, interval '1 day') d
      cross join generate_series(1, 10) n join auth.users us on us.email = '${u.email}'
      where s.name = '${site}';`,
    },
  );
  const range = "bas=2026-01-01&bit=2026-01-31";

  await page.goto(`/rapor?${range}`);
  await expect(
    page.getByText("1200 sefer", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("1.200 sefer ×")).toBeVisible();
  await expect(page.getByText("₺1.080.000,00").first()).toBeVisible();

  await page.goto(`/hakedis?${range}`);
  await expect(page.getByText("₺1.080.000,00").first()).toBeVisible();
  await expect(
    page.getByText("Günlük kira · 12 gün × ₺9.000,00").first(),
  ).toBeVisible();

  await page.goto(`/kayitlar?tur=sefer&${range}`);
  await expect(page.getByText("Toplam 1200 sefer")).toBeVisible();
  await page.context().close();
});

test("K18: şifremi unuttum ve şifre değiştirme", async ({ browser }) => {
  const page = await newPage(browser);
  const u = { email: `sifre-${run}@hafriyol.local`, password: "Sifre-12345" };
  await signUp(page, u);
  await createTenant(page, "Şifre Deneme İnşaat");

  // Yeni şifre (menüden); eski şifre artık çalışmaz, yenisiyle girilir
  await page.goto("/menu");
  await page.getByRole("link", { name: "Şifremi değiştir" }).click();
  await page.locator("#password").fill("Yeni-Sifre-678");
  await page.locator("#password_again").fill("Baska-Sifre-678");
  await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(page.getByText("Şifreler aynı değil")).toBeVisible();
  await page.locator("#password").fill("Yeni-Sifre-678");
  await page.locator("#password_again").fill("Yeni-Sifre-678");
  await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await page.waitForURL("**/panel?sifre=1");
  await expect(page.getByText("Şifreniz değiştirildi.")).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/giris");
  await page.locator("#email").fill(u.email);
  await page.locator("#password").fill(u.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByText("E-posta veya şifre hatalı")).toBeVisible();
  await signIn(page, { email: u.email, password: "Yeni-Sifre-678" });
  await page.context().clearCookies();

  // Şifremi unuttum: kayıtlı olsun olmasın aynı mesaj (kimin kayıtlı olduğu belli olmaz)
  for (const email of [u.email, `yok-${run}@hafriyol.local`]) {
    await page.goto("/giris");
    await page.getByRole("link", { name: "Şifremi unuttum" }).click();
    await page.locator("#email").fill(email);
    await page.getByRole("button", { name: "Bağlantı gönder" }).click();
    await expect(
      page.getByText(
        "E-posta adresi kayıtlıysa şifre yenileme bağlantısı gönderildi",
      ),
    ).toBeVisible();
  }
  // Başka siteye yönlendirme denemesi uygulama içinde kalır
  await page.goto("/giris?sonra=%2F%5Cevil.example");
  await page.locator("#email").fill(u.email);
  await page.locator("#password").fill("Yeni-Sifre-678");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL("**/panel");
  await page.context().close();
});

test("K20: tablet ve dizüstünde menünün tüm öğeleri ekranda", async ({
  browser,
}) => {
  for (const width of [768, 1024, 1280]) {
    const page = await newPage(browser);
    await page.setViewportSize({ width, height: 800 });
    await signIn(page, owner);
    const links = page
      .getByRole("navigation", { name: "Üst menü" })
      .getByRole("link");
    expect(await links.count()).toBeGreaterThanOrEqual(12);
    for (const link of await links.all()) {
      const box = (await link.boundingBox())!;
      expect(
        box.x + box.width,
        `${width}px: ${await link.innerText()} ekran dışında`,
      ).toBeLessThanOrEqual(width);
    }
    await expectNoHorizontalScroll(page);
    await page.context().close();
  }
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
  await expect(page.getByText("Bu aralıkta girilmiş gider yok.")).toBeVisible();
  await page.goto("/hakedis");
  await expect(page.getByText("Yılmaz Nakliyat")).toHaveCount(0);

  const siteId = siteUrl.split("/").pop()!;
  expect(
    (await page.request.get(`/rapor/excel?santiye=${siteId}`)).status(),
  ).toBe(404);
  // Adres çubuğuna başka firmanın şantiyesini yazmak raporu açmaz, kendi (boş) verisine döner
  await page.goto(`/rapor?santiye=${siteId}`);
  await expect(page.getByText("Çevre Yolu 1. Kısım")).toHaveCount(0);
  await page.context().close();
});
