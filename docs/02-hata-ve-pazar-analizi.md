# Hafriyol — Hata Analizi, Pazar Analizi ve Yol Haritası (Ana Prompt)

> **Güncelleme 27.10.2026:** Faz 0 hatalarının çoğu düzeltildi; bkz. 4.4 tablosundaki "Düzeltildi" sütunu.
>
> **Nasıl kullanılır:** Bu belgenin tamamını bir yapay zekâya (Claude, ChatGPT vb.) yapıştırın. Belge; rol, bağlam, kurallar, bulgular, görevler ve kabul kriterlerini içerir. Tek bir bölümü (ör. yalnızca "4. Hata analizi") vermek de yeterlidir. Tarih: 27.10.2026. Kod sürümü: `c305a80` (dal `ccr-0055c109-5sddea`).

---

## 1. ROL

Sen; Next.js 15 (App Router), React 19, TypeScript, Supabase (PostgreSQL + RLS + Auth + Storage) ve Vercel konusunda deneyimli bir **kıdemli full-stack geliştiricisin**. Aynı zamanda Türkiye'deki **hafriyat, yol ve altyapı yüklenicilerinin** iş yapış biçimini bilen bir **ürün uzmanısın**:
- sefer ve puantaj,
- kiralık makine,
- taşeron hakedişi,
- kantar fişi,
- mazot,
- KDV tevkifatı,
- KGM birim fiyatları.

Amacın: aşağıdaki hataları **önce yeniden üretip testle kanıtlamak**, sonra düzeltmek ve ürünü rakiplerin önüne geçirecek özellikleri sırayla eklemek.

---

## 2. BAĞLAM

### 2.1 Ürün

**Hafriyol**, küçük ve orta ölçekli hafriyat, yol ve altyapı firmaları için telefon öncelikli bir şantiye takip uygulamasıdır.

- Canlı adres: https://hafriyol.vercel.app (Vercel, Frankfurt). Bu dala yapılan her gönderim otomatik yayınlanır.
- Veritabanı: Supabase, proje `rzvyaodxwllamnmksqpy` (Frankfurt). Organizasyon planı: **ücretsiz (free)**.
- Hedef kullanıcılar:
  - **Firma sahibi:** her şeyi görür.
  - **Yönetici:** kayıtları ve giderleri yönetir.
  - **Saha personeli (puantör/şef):** sefer, imalat ve makine girer; para tutarlarını görmemelidir.

### 2.2 Mevcut özellikler

| Alan | Var olan |
|---|---|
| Sefer | Tek dokunuşla sefer sayacı (her dokunuş = 1 satır). İsteğe bağlı kantar tonu. Güzergâh seçimi. Geri al. İnternetsiz kuyruk (localStorage). |
| Günlük giriş | Elle imalat ve sefer (sefer sayısı ve toplam ton). |
| Makine | Saat ve mazot girişi; yakıt normu aşım uyarısı. |
| Denetim | Güzergâh çevrim süresine göre "şişirilmiş sefer" uyarısı. |
| Gelir | Güzergâh bir iş kalemine bağlanınca seferler imalat tutarına dönüşür (birim `sefer` veya `ton`). |
| Gider | Elle gider (KDV oranlı). Kiralık/taşeron araç kirası otomatik hesaplanır (günlük, saatlik veya sefer başı). |
| Taşeron | Taşeron hakedişi ekranı ve Excel çıktısı. |
| Rapor | Dönem raporu (imalat, gider, sefer, makine). Excel ve PDF çıktısı. |
| Fotoğraf | Kantar fişi, saha ve hasar fotoğrafı (sıkıştırılıp özel depoya yüklenir). |
| Paylaşım | WhatsApp gün sonu özeti (para tutarı içermez). |
| Kurulum | 1 dakikalık kurulum: hazır iş kalemleri, plakaları alt alta yazma, "kiralık 9000" sözdizimi. |
| Firma | Çoklu firma, rol tabanlı erişim, e-posta ile kullanıcı ekleme. |
| Telefon | PWA (ana ekrana eklenir), service worker önbelleği. |

### 2.3 İyi çalışan temeller (korunmalı)

- Her tabloda `tenant_id` ve RLS var. Bileşik yabancı anahtarlar `(x_id, tenant_id[, site_id])` başka firmanın kaydına bağlanmayı engeller.
- `client_request_id` ile tekrar gönderilen istek ikinci kez kaydedilmez.
- Para hesabı tam sayı **kuruş** ile yapılır (`src/lib/money.ts`).
- Türkçe sayı ayrıştırma (`parseTrNumber`) ve Türkiye saatine göre tarih (`isoDateTR`).
- Testler: 90 birim testi (Vitest), RLS testleri T1–T18 (`supabase/tests/rls_test.sql`), Playwright kabul testleri K1–K14 (yerel Supabase kopyası `scripts/e2e-stack.sh`).

---

## 3. DEĞİŞMEZ KURALLAR

1. `service_role` anahtarı istemci koduna veya `NEXT_PUBLIC_` değişkenine **asla** konmaz. Tüm sorgular kullanıcının oturumuyla, RLS altında çalışır.
2. Para hesabı kuruş (tam sayı) ile yapılır. Ekranda `formatTL`, girişte `parseTrNumber` kullanılır.
3. Supabase migration'larında `DROP` kullanılmaz. Bunun yerine `ALTER`, `create or replace` ve yeni sütun/tablo eklenir. Mevcut veri silinmez.
4. Arayüz ve hata mesajları Türkçedir. Teknik hata kullanıcıya gösterilmez (`dbErrorMessage`).
5. Her değişiklikten sonra şunlar çalıştırılır ve çıktısı gösterilir: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build` ve e2e (`./scripts/e2e-stack.sh` + `npx playwright test`). **Çalıştırılmadan "başarılı" denmez.**
6. Her düzeltme önce hatayı gösteren bir testle başlar (önce kırmızı, sonra yeşil).
7. Saha personeli hiçbir ekranda, API'de veya dışa aktarımda para tutarı ya da birim fiyat görmez.
8. Kullanıcının veri girişi hiçbir koşulda sessizce kaybolmaz. Kaybolacaksa açık uyarı ve kurtarma yolu gösterilir.

---

## 4. HATA ANALİZİ

### 4.1 Yöntem

- **Kod incelemesi:** ~10 bin satırın tamamı okundu (migration'lar, server action'lar, hesap kütüphaneleri, sayfalar, service worker).
- **Canlı sistem:** Vercel çalışma zamanı hataları (son 7 gün), Supabase güvenlik ve performans danışmanı, Supabase/Vercel plan bilgisi.
- **Yeniden üretme:** Şüpheli hatalar yerel Supabase kopyasında Playwright ile denendi. PostgREST, Supabase'in varsayılanı olan `PGRST_DB_MAX_ROWS=1000` ile çalıştırıldı. Senaryo: 10 kiralık kamyon × 12 gün × günde 10 sefer = 1200 sefer.

### 4.2 Önem ölçeği

- **P0 (kritik):** veri kaybı, yanlış para hesabı, canlıda bozuk özellik.
- **P1 (yüksek):** güven veya gizlilik ihlali, sık karşılaşılan yanlış sonuç.
- **P2 (orta):** belirli koşullarda yanlış sonuç veya kullanım engeli.
- **P3 (düşük):** iyileştirme veya teknik borç.

### 4.3 Durum etiketleri

- **Doğrulandı:** canlı kayıtlarda veya yeniden üretilerek görüldü.
- **Kodda görüldü:** koddan kesin olarak çıkıyor; yeniden üretilmedi.
- **Şüpheli:** denendi, beklenen sonuç görülmedi ama risk sürüyor.

### 4.4 Özet tablo

| Kimlik | Önem | Başlık | Durum | Düzeltildi |
|---|---|---|---|---|
| H01 | P0 | Canlıda "PDF indir" çalışmıyor | Doğrulandı | ✔ `b635737` |
| H02 | P0 | 1000 satır sınırı: rapor, hakediş ve otomatik kira eksik çıkıyor | Doğrulandı | ✔ `89644fa` |
| H03 | P0 | İnternetsiz girilen seferler kayboluyor | Doğrulandı | ✔ `1277bce` |
| H04 | P1 | Ücret değişikliği geçmiş dönemi değiştiriyor | Doğrulandı | ✔ F1-4 (ücret geçmişi + dönem kilidi) |
| H05 | P1 | Saha personeli birim fiyat ve kira ücretlerini görüyor | Doğrulandı | ✔ `d5f9854` |
| H06 | P1 | Kayıtlar ve Giderler toplamları ilk 500 satırdan | Doğrulandı | ✔ `89644fa` |
| H07 | P1 | "Şifremi unuttum" yok; Auth ayarları eksik | Kodda görüldü | ✔ `75bf9d2` |
| H08 | P1 | Gece vardiyası iki güne bölünüyor (2 gün kira) | Kodda görüldü | ✔ F1-3 (iş günü başlangıcı) |
| H09 | P1 | Elle imalat ile bağlı güzergâh seferleri çift sayılıyor | Kodda görüldü | ✔ F1-9 (tetikleyici) |
| H10 | P1 | "Son seferi sil" 12 seferlik kaydın tamamını siliyor | Doğrulandı | ✔ `89644fa` |
| H11 | P1 | Ücretsiz Supabase planı (duraklatma, yedek yok); Vercel planı belirsiz | Doğrulandı (Supabase) | — |
| H12 | P1 | CI ve hata izleme yok | Doğrulandı | ✔ `0ec78b6` |
| H13 | P3 | Giriş sonrası yönlendirme (`sonra`) kontrolü zayıf | Şüpheli | ✔ `75bf9d2` |
| H14 | P2 | İki şantiyede aynı gün çalışan aracın kirası şantiye raporlarında çift | Kodda görüldü | — |
| H15 | P2 | Sayaç firmanın tüm araçlarını gösteriyor (araç–şantiye ataması yok) | Kodda görüldü | ✔ `091efcf` |
| H16 | P2 | Çift dokunuş ve iki puantörün aynı kamyonu sayması engellenmiyor | Kodda görüldü | ✔ F1-8 (çift sayım uyarısı) |
| H17 | P2 | "Ton" birimli kalemde tonu girilmemiş seferler gelire girmiyor | Kodda görüldü | ✔ F1-9 (rapor uyarısı) |
| H18 | P2 | Hızlı kurulum tek işlem (transaction) değil | Kodda görüldü | — |
| H19 | P2 | İş kuralları yalnız uygulamada; veritabanında yok, dönem kilidi yok | Kodda görüldü | ✔ F1-4 (kilit + 7 gün kuralı veritabanında) |
| H20 | P2 | Makine/kamyon ayrımı serbest metinden tahmin ediliyor | Kodda görüldü | ✔ `091efcf` |
| H21 | P2 | Service worker önbelleği: yanlış şantiye, paylaşılan telefon, eski veri uyarısı yok | Kodda görüldü | — |
| H22 | P2 | Fotoğraflar internetsiz kuyruğa alınmıyor; sefere bağlanamıyor | Kodda görüldü | — |
| H23 | P2 | Tablet ve dizüstünde üst menü ekrandan taşıyor | Doğrulandı | ✔ `75bf9d2` |
| H24 | P2 | Araç, güzergâh ve üyelik değişiklikleri işlem geçmişine yazılmıyor | Kodda görüldü | ✔ F1-10 (işlem geçmişi ekranı) |
| H25 | P2 | Kullanıcı ekleme: davet yok, e-posta varlığı sızıyor, rıza alınmıyor | Kodda görüldü | — |
| H26 | P2 | m³ ve kabarma katsayısı yok; kapasite yalnız ton | Kodda görüldü | — |
| H27 | P3 | RLS'te çoklu izin politikası (Supabase danışmanı uyarısı) | Doğrulandı | — |
| H28 | P3 | Her istekte iki kez `getUser` (gecikme) | Kodda görüldü | — |
| H29 | P3 | Excel/PDF'te KDV dahil toplam ondalıklı sayıyla toplanıyor | Kodda görüldü | — |
| H30 | P3 | Otomatik araç kirası KDV'siz; "KDV dahil toplam" eksik görünür | Kodda görüldü | — |
| H31 | P3 | Sınırsız firma açılabiliyor | Kodda görüldü | — |
| H32 | P3 | Kayıt düzenleme yok (yalnız sil ve yeniden gir) | Kodda görüldü | ✔ F1-10 (imalat, makine, gider düzeltme; sefer F1-7) |

### 4.5 Ayrıntılı bulgular

#### H01 — Canlıda "PDF indir" çalışmıyor · P0 · Doğrulandı
- **Kanıt (canlı sistem):** Vercel çalışma zamanı hatası 25.10.2026 17:21'de `/rapor/pdf` için 15 kez görüldü: `Error: Cannot find module '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'`.
- **Kök neden:** `@react-pdf/renderer` → `pdfkit`, standart fontları `#standard-fonts/*` alt yol içe aktarımıyla dinamik olarak yükler. Next'in dosya izleyicisi bu dosyaları görmüyor. Derleme izinde (`.next/server/app/(app)/rapor/pdf/route.js.nft.json`) pdfkit'ten yalnızca 3 dosya var, `standard-fonts` yok. `next.config.ts` yalnızca `./assets/fonts/**` dosyalarını ekliyor.
- **Neden testler yakalamadı:** Kabul testleri yerelde `next start` ile ve tam `node_modules` ile çalışıyor. Vercel ise yalnız izlenen dosyaları paketliyor.
- **Etki:** Canlıda PDF butonuna basan her kullanıcı hata alıyor.
- **Çözüm:** `outputFileTracingIncludes["/rapor/pdf"]` listesine `"./node_modules/pdfkit/js/standard-fonts/**/*"` (ve gerekirse `./node_modules/pdfkit/js/data/**/*`) eklenir.
- **Kabul:**
  - (1) Derleme sonrası nft dosyasında `standard-fonts/Helvetica.cjs` bulunduğunu kontrol eden bir test (`tests/build-trace.test.ts`; CI'da build'den sonra çalışır).
  - (2) Canlı yayından sonra PDF indirme duman testi.
  - (3) Vercel'de yeni `MODULE_NOT_FOUND` hatası görülmemesi.

#### H02 — 1000 satır sınırı: rapor, hakediş ve otomatik kira sessizce eksik · P0 · Doğrulandı
- **Kanıt (yeniden üretme):** Veritabanında 1200 sefer vardı. Sınırsız API sorgusu **1000 satır** döndürdü.
  - **Dönem raporu**, aynı ekranda hem "Hafriyat nakliyesi **1.200 sefer**" (SQL fonksiyonundan) hem "Seferler – Toplam **1000 sefer**" (satır listesinden) gösterdi.
  - **Taşeron hakedişi** 10 kamyon × **10 gün** × 9.000 = **900.000 TL** gösterdi. Doğrusu 12 gün × 9.000 × 10 = **1.080.000 TL**: **180.000 TL eksik** (%16,7).
  - **Giderler** ekranındaki "Araç kirası / taşeron (otomatik)" ve rapordaki "Gider" de aynı şekilde 900.000 TL çıktı.
- **Kök neden:** Supabase Data API varsayılan olarak bir sorguda en fazla 1000 satır döndürür; fazlasını hata vermeden keser. Kesilen sorgular:
  - `src/lib/report.ts:213` (sefer satırları) ve `:215` (makine kayıtları),
  - `src/lib/contractor.ts:142-148` (hakediş ve otomatik kira; firma geneli).

  Sayaç her dokunuşu ayrı satır yazdığı için sınır çok çabuk dolar: 15 kamyon × günde 15 sefer ≈ **4,5 günde 1000 satır**. Ayın ilk haftasından sonra rapor ve hakediş yanlış çıkar.
- **Etki:** Taşerona yanlış ödeme, yanlış maliyet ve kâr; kullanıcı güveninin kaybı.
- **Çözüm:**
  - Toplamlar veritabanında hesaplanmalı. Yeni `security invoker` SQL fonksiyonları (`trip_summary(p_site, p_from, p_to)`, `contractor_pay_basis(p_tenant, p_site, p_from, p_to)`) araç/güzergâh/gün bazında **gruplanmış** satırlar döndürsün (en fazla birkaç yüz satır).
  - Satır gerektiren listeler `.range()` ile sayfalanmalı.
  - Kesilme olasılığı kalan yerde `count: 'exact'` ile kontrol edilip uyarı gösterilmeli.
- **Kabul:**
  - Yerel yığında PostgREST `PGRST_DB_MAX_ROWS=1000` ile çalıştırılır (e2e betiğine kalıcı eklenmeli; canlıyla aynı davranış).
  - 1200 seferle rapor toplamı = 1200, hakediş = 1.080.000 TL.
  - Yeni e2e testi K15 eklenir.

#### H03 — İnternetsiz girilen seferler kayboluyor · P0 · Doğrulandı
- **Kanıt (yeniden üretme):**
  - (a) **Çıkışta kayıp:** Bağlantı koptuğunda 3 sefer telefona yazıldı (kuyruk = 3). Kullanıcı sayaca dönmeden Menü → "Çıkış yap" dedi. Kuyruk silindi (`null`), veritabanında 0 sefer. **3 sefer uyarısız kayboldu.**
  - (b) **Sunucu reddinde kayıp:** Kuyruğa 8 gün önceki bir sefer kondu. Sayaç açılınca sunucu "Sefer tarihi geçersiz" dedi. Sefer kuyruktan **silindi** (`[]`) ve veritabanına yazılmadı (10 → 10).
- **Kök neden:**
  - `src/components/sw-register.tsx` içindeki `clearCachedPages()` çıkışta `localStorage.removeItem("hafriyol_kuyruk")` çalıştırıyor.
  - `src/app/(app)/sefer/trip-counter.tsx:85-87`, sunucudan hata dönse bile kaydı kuyruktan çıkarıyor.
  - Kuyruk yalnızca `/sefer` ekranı açıkken gönderiliyor (`TripCounter` içindeki `flush`). Kullanıcı başka ekranda kalırsa 7 gün sınırı dolup tüm seferler reddedilebilir.
  - Kuyruk kaydında firma ve kullanıcı bilgisi yok. Firma değiştirilince veya telefonu başka biri kullanınca seferler yanlış firmaya ya da kişiye gidebilir veya reddedilir.
- **Etki:** Şantiyede çekmeyen yerde girilen seferler (ürünün ana vaadi) kaybolabiliyor.
- **Çözüm:**
  - Çıkışta kuyruk boş değilse "X sefer telefonda bekliyor" uyarısı gösterilmeli. Önce gönderim denenmeli; kullanıcı onaylamadan silinmemeli.
  - Reddedilen kayıtlar ayrı bir "gönderilemeyenler" listesine taşınmalı ve sebep gösterilmeli. Yönetici onayıyla eski tarih kabul edilebilmeli.
  - Gönderim uygulama kabuğunda (layout) çalışmalı (her ekranda, `online` olayında ve belirli aralıklarla).
  - Kuyruk kaydına `tenantId` ve `userId` eklenmeli; yalnızca aynı kullanıcı ve firma için gönderilmeli.
- **Kabul:** E2E K16:
  - İnternetsiz 3 sefer → çıkış → uyarı gelir, seferler kaybolmaz.
  - Reddedilen kayıt "gönderilemeyenler" listesinde görünür.
  - Başka ekrandayken bağlantı gelince seferler gönderilir.

#### H04 — Ücret değişikliği geçmiş dönemin hakedişini değiştiriyor · P1 · Doğrulandı
- **Kanıt:** 10.10–21.10 dönemi hakedişi **900.000 TL** idi. Bugün 34 HF 001'in günlük kirası 9.000 → 12.000 yapıldı. Aynı geçmiş dönemin hakedişi **930.000 TL** oldu.
- **Kök neden:**
  - Ücretler (`vehicles.daily_rate`, `vehicles.hourly_rate`, `routes.trip_price`, `work_items.unit_price`) sefer veya kayıt anında saklanmıyor; her hesapta güncel değer okunuyor.
  - Güzergâhın bağlı olduğu iş kalemi değişince geçmiş seferler de yeni kaleme taşınıyor (`production_summary` sorgusu güncel `routes.work_item_id` değerine bakıyor).
  - Dönem kapatma yok.
- **Etki:** Ödenmiş ve kapanmış bir ay sonradan değişiyor; taşeron mutabakatı bozuluyor.
- **Çözüm:**
  - Ücret geçmişi tablosu: `rate_history(vehicle_id | route_id | work_item_id, rate_type, amount, valid_from)`. Hesap, kaydın tarihindeki ücretle yapılır.
  - Ya da hakediş "onaylanınca" anlık görüntüsü saklanır.
  - `period_locks(tenant_id, site_id, until_date)`: kilitli tarihlere ekleme, düzeltme ve silme RLS ile engellenir.
- **Kabul:** Ücret değişikliği yalnızca `valid_from` tarihinden sonrasını etkiler. Kilitli döneme kayıt girilemez (RLS testi T19).

#### H05 — Saha personeli birim fiyat ve kira ücretlerini görüyor · P1 · Doğrulandı
- **Kanıt:**
  - Saha kullanıcısının şantiye sayfasında "₺750,00 / sefer" (işveren birim fiyatı) ve "₺900,00/sefer" (taşeron sefer ücreti) görünüyor.
  - Aynı kullanıcı kendi oturumuyla API'den `vehicles.daily_rate = 9000`, `routes.trip_price = 900` ve `work_items.unit_price = 750` okuyabiliyor. (Herkese açık anahtar tarayıcı paketinde, oturum çerezde olduğu için bu teknik bilgisi olan herkes için mümkün.)
- **Kök neden:**
  - `src/app/(app)/santiyeler/[id]/page.tsx:95` ve `:143` fiyatları rol kontrolü olmadan gösteriyor.
  - RLS `*_select` politikaları tüm üyelere bütün sütunları açıyor.
- **Etki:** Ürünün "saha personeli para görmez" ilkesi bozuluyor. Taşeron şoförü veya puantör kendi ücretini ve işverenin fiyatını görüyor; pazarlık ve anlaşmazlık riski.
- **Çözüm:**
  - Fiyat sütunları ayrı bir tabloya taşınır: `work_item_prices`, `route_prices`, `vehicle_rates`. RLS'i yalnızca owner/manager için açılır. (Yeni tablolar eklenir, eskiler `ALTER` ile boşaltılmadan önce veri kopyalanır; DROP yok.)
  - Ya da sütun düzeyi yetki (`revoke select (unit_price) ... from authenticated` + yönetici görünümü) kullanılır.
  - Arayüzde fiyatlar `manager` koşuluna bağlanır.
- **Kabul:** RLS testi T20 (saha personeli fiyat sütununu okuyamaz) ve e2e: saha ekranında "₺" geçmez.

#### H06 — Kayıtlar ve Giderler toplamları ilk 500 satırdan · P1 · Doğrulandı
- **Kanıt:** 1200 seferlik ayda Kayıtlar → Sefer sekmesi "**Toplam 500 sefer**" gösterdi. Küçük bir "İlk 500 kayıt gösteriliyor" notu çıkıyor ama başlık "Toplam" diyor.
- **Kök neden:** `src/app/(app)/kayitlar/page.tsx:155-186` ve `src/app/(app)/giderler/page.tsx:50-60` toplamı `limit(500)` listesinden hesaplıyor.
- **Çözüm:** Toplamlar SQL fonksiyonuyla (bkz. H02), liste sayfalı. Sefer listesi zaten gruplu gösterildiği için gruplama veritabanında yapılmalı.
- **Kabul:** 1200 seferde toplam 1200; liste "Daha fazla" ile sayfalanır.

#### H07 — "Şifremi unuttum" yok; Auth ayarları eksik · P1 · Kodda görüldü
- **Kanıt:**
  - `resetPasswordForEmail` hiçbir yerde kullanılmıyor; giriş sayfasında bağlantı yok.
  - Supabase danışmanı: "Leaked Password Protection Disabled".
  - Supabase Auth → URL Configuration (Site URL `https://hafriyol.vercel.app`, Redirect `…/auth/callback`) hâlâ kullanıcı tarafında bekliyor.
- **Etki:** Şifresini unutan kullanıcı kilitlenir; destek yükü oluşur.
- **Çözüm:**
  - `/sifre-unuttum` (e-posta) ve `/sifre-yenile` (`updateUser`) sayfaları; callback'te `type=recovery` işlenmesi.
  - Hesap sayfasında şifre değiştirme.
  - Danışmandaki ayar açılır.
- **Kabul:** E2E: şifre sıfırlama bağlantısı yerel GoTrue e-posta kutusundan alınıp yeni şifreyle giriş yapılır.

#### H08 — Gece vardiyası iki güne bölünüyor (günlük kira 2 gün) · P1 · Kodda görüldü
- **Kanıt:**
  - Sayaç tarihi sayfa açıldığı anda sabitleniyor (`sefer/page.tsx:106`, `today` prop → `trip-counter.tsx:154`).
  - Günlük kira "seferi olan gün sayısı" ile hesaplanıyor (`src/lib/contractor.ts:84-88`).
  - Gece yarısını geçen vardiyada sayfa yenilenirse seferler iki tarihe bölünür ve kiralık kamyona **2 günlük kira** yazılır. Sayfa yenilenmezse ertesi günün seferleri bir önceki güne gider.
- **Bağlam:** İstanbul gibi şehirlerde hafriyat taşıması büyük ölçüde gece yapılır.
- **Çözüm:**
  - Şantiye ayarı olarak "iş günü başlangıç saati" (ör. 06:00) ve `shift_date` hesabı (sunucuda, gönderim saatine göre).
  - Sayaçta gün değişince uyarı.
  - Günlük kira vardiya gününe göre sayılır.
- **Kabul:** Birim testi: 22:00–04:00 seferleri tek iş gününe yazılır, tek gün kira çıkar.

#### H09 — Elle imalat ile bağlı güzergâh seferleri çift sayılıyor · P1 · Kodda görüldü
- **Kanıt:**
  - `production_summary` elle girilen imalat ile bağlı güzergâhtaki seferleri **topluyor** (union).
  - Günlük giriş formu (`gunluk/page.tsx:98`) bağlı kalemleri de listeliyor.
  - Kullanıcı "Hafriyat nakliyesi"ne elle 120 sefer girer, sayaçta da 120 sefer sayarsa raporda 240 sefer ve iki kat gelir çıkar.
- **Çözüm:** Güzergâha bağlı kalemler elle imalat formunda gizlenir (veya "seferlerden otomatik" etiketiyle kilitlenir). Raporda kaynak ayrımı gösterilir: "sayaçtan / elle".
- **Kabul:** Bağlı kaleme elle giriş yapılamaz; RLS veya tetikleyici ile de engellenir.

#### H10 — "Son seferi sil" 12 seferlik kaydın tamamını siliyor · P1 · Doğrulandı
- **Kanıt:** Günlük girişte elle "12 sefer" girildi ("Sefer (12 sefer)"). "Son seferi sil" düğmesine bir kez basıldı; sonuç "**Sefer (0 sefer)**".
- **Kök neden:** `src/lib/trip-groups.ts` gruptaki en son **kaydı** siliyor. Düğme metni ve onay metni ("Bu araçtaki son sefer silinsin mi?") tek sefer siliniyormuş gibi söylüyor.
- **Çözüm:**
  - Son kayıt çoklu seferse düğme "Son kaydı sil (12 sefer)" olur ve onay metni sayıyı söyler.
  - Ya da çoklu kayıtta `trip_count` bir azaltılır.
  - Grup açılınca tek tek kayıtlar (saat ve giren kişi) görünür.
- **Kabul:** E2E: 12 seferlik kayıtta onay metni "12 sefer" içerir; iptal edilince hiçbir şey silinmez.

#### H11 — Ücretsiz Supabase planı; Vercel planı belirsiz · P1 · Doğrulandı (Supabase)
- **Kanıt:** Supabase organizasyon planı `free`.
- **Riskler:**
  - Ücretsiz projeler hareketsiz kalınca duraklatılır ([Supabase: Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
  - Ücretsiz planda zamana göre geri dönüş (PITR) yok ve yedekleme kısıtlı.
  - Vercel'in Hobby planı kişisel ve ticari olmayan kullanım içindir. Ürün satılacaksa Pro gerekir (hesap planı doğrulanmalı).
- **Çözüm:** Satışa çıkmadan Supabase Pro (günlük yedek, duraklatma yok) ve Vercel Pro. Haftalık mantıksal yedek (`pg_dump`) için ayrı bir zamanlanmış iş.
- **Kabul:** Yedekten geri dönüş bir kez denenmiş ve belgelenmiş.

#### H12 — CI ve hata izleme yok · P1 · Doğrulandı
- **Kanıt:**
  - Depoda `.github/workflows` yok; testler yalnızca elle çalıştırılıyor.
  - H01'deki PDF hatası iki gün fark edilmedi; hata bildirimi (Sentry vb.) yok.
  - E2E ortamı canlıdan iki noktada farklı: satır sınırı yok ve Vercel paketlemesi yok. Bu yüzden H01 ve H02'yi yakalayamadı.
- **Çözüm:**
  - GitHub Actions: lint, typecheck, unit, test:db, build, nft kontrolü, e2e.
  - E2E yığınında `PGRST_DB_MAX_ROWS=1000`.
  - Yayın sonrası duman testi (giriş, rapor, PDF, Excel).
  - Hata izleme: Sentry veya Vercel Observability uyarıları.
- **Kabul:** Her PR'da yeşil CI zorunlu; canlıda 5xx olunca e-posta veya push bildirimi.

#### H13 — Giriş sonrası yönlendirme kontrolü zayıf · P3 · Şüpheli
- **Kod:** `src/app/(auth)/actions.ts` içindeki `safeNext` yalnızca `"/"` ile başlayıp `"//"` ile başlamamayı kontrol ediyor. `"/\evil.example"` gibi ters eğik çizgili değerler geçiyor.
- **Deneme:** `?sonra=/%5Cevil.example/giris` ile girişte Chromium ve Next 15.5'te başka siteye istek gözlenmedi; kullanıcı giriş ekranında kaldı. Yani açık yönlendirme bugün sömürülemedi ama giriş akışı bozuluyor.
- **Çözüm:** `new URL(v, "http://x").origin === "http://x"` kontrolü yapılır; ters eğik çizgi ve kontrol karakterleri reddedilir.

#### H14 — Aynı gün iki şantiyede çalışan aracın kirası çift · P2 · Kodda görüldü
- **Kanıt:** `loadContractorPayments` şantiye filtresiyle çağrıldığında gün sayısı her şantiyede ayrı hesaplanıyor. Aynı gün A ve B şantiyesinde çalışan kiralık kamyon iki şantiye raporunda da 1'er gün kira alıyor; firma toplamında ise 1 gün.
- Ayrıca `kayitlar/page.tsx:213`, güzergâhsız seferleri şantiyeler arasında aynı gruba koyup ilk şantiyenin adını yazıyor.
- **Çözüm:**
  - Günlük kira, günün ilk (veya ağırlıklı) şantiyesine yazılır ya da sefer oranına göre paylaştırılır; kural ekranda açıklanır.
  - Gruplama anahtarına `site_id` eklenir.

#### H15 — Sayaç firmanın tüm araçlarını gösteriyor · P2 · Kodda görüldü
- **Kanıt:** `sefer/page.tsx:108` araçları şantiyeye göre süzmüyor. 40 araçlı ve 4 şantiyeli bir firmada her şantiyede 40 kart çıkar; yanlış karta dokunma olasılığı artar.
- **Çözüm:** `vehicle_assignments(vehicle_id, site_id, from, to)`; sayaçta yalnız atanmış araçlar (diğerleri "başka araç ekle" altında). Kurulumda yazılan araçlar o şantiyeye atanır.

#### H16 — Çift dokunuş ve çift sayım engellenmiyor · P2 · Kodda görüldü
- **Kanıt:** Her dokunuş yeni bir `requestId` ile kaydediliyor; aynı kamyona 2 saniye arayla iki dokunuş 2 sefer sayılıyor. Yükleme ve döküm noktasında iki ayrı puantör aynı kamyonu sayarsa sefer iki katına çıkıyor.
- **Çözüm:**
  - Araç başına "en az X dakika" (güzergâh çevrim süresinin %50'si) aralık uyarısı: "Bu kamyon 1 dk önce sayıldı. Yine de say?".
  - Sayan kişinin rolü: "yükleme noktası" / "döküm noktası". İki noktadan gelen sayımlar eşleştirilir (bkz. Yol haritası F1-1).

#### H17 — "Ton" birimli kalemde tonsuz seferler gelire girmiyor · P2 · Kodda görüldü
- **Kanıt:** `production_summary`, `ton` birimi için `te.tonnage` kullanıyor; tonu girilmemiş sefer `null` olup atlanıyor. Raporda bununla ilgili uyarı yok; gelir eksik görünüyor.
- **Çözüm:** Tonsuz seferler "tahmini (kapasite × sefer)" olarak ayrı satırda gösterilir ve hakedişten önce uyarılır: "37 seferin kantar tonu eksik".

#### H18 — Hızlı kurulum tek işlem değil · P2 · Kodda görüldü
- **Kanıt:** `src/app/(app)/kurulum/actions.ts` şantiye, iş kalemi, güzergâh ve araçları ayrı sorgularla ekliyor. Ortada hata olursa şantiye açılmış kalıyor; tekrar denenince ikinci şantiye oluşuyor.
- **Çözüm:** Tek bir `quick_setup(...)` SQL fonksiyonu (transaction) veya hata halinde geri alma.

#### H19 — İş kuralları yalnız uygulamada; dönem kilidi yok · P2 · Kodda görüldü
- **Kanıt:**
  - "En fazla 7 gün geriye", "ton 0–200" ve "ileri tarih yok" kuralları yalnızca server action'da (`sefer/actions.ts`) var.
  - RLS saha personelinin herhangi bir tarihe 500'e kadar sefer eklemesine izin veriyor.
  - Elle girişte tarih sınırı yok (yalnızca ileri tarih uyarısı).
  - Saha personeli kendi eski kayıtlarını her zaman silebiliyor.
- **Çözüm:** CHECK kısıtları ve tetikleyiciler (tarih penceresi, ton üst sınırı rolle değişir); dönem kilidi (H04) ile birlikte.

#### H20 — Makine/kamyon ayrımı serbest metinden · P2 · Kodda görüldü
- **Kanıt:** `isMachineType` düzenli ifadesi (`field-checks.ts:225`) "kazıcı yükleyici", "JCB", "paletli", "arazöz" gibi türleri yanlış sınıflandırır; makine sayaçta, kamyon makine ekranında çıkabilir.
- **Çözüm:** Araçlara `kind` alanı (`kamyon | is_makinesi | diger`). Kurulumda tahmin edilir, kullanıcı değiştirebilir.

#### H21 — Service worker önbelleği · P2 · Kodda görüldü
- **Kanıt:** `public/sw.js:50` sayfaları adres parametresi olmadan önbelleğe alıyor.
  - Çevrimdışıyken `/rapor?santiye=B` açılınca A şantiyesinin raporu çıkabilir.
  - Finansal sayfalar (giderler, rapor, hakediş) telefonda saklanıyor; yalnızca açık çıkışta temizleniyor (oturum süresi dolarsa kalır).
  - Önbellekten gösterilen sayfada "çevrimdışı / eski veri" uyarısı yok.
- **Çözüm:**
  - Önbellek anahtarında arama parametresi kullanılır.
  - Finansal sayfalar önbelleğe alınmaz (`Cache-Control: no-store` veya izin listesi).
  - Önbellekten gelen sayfaya "Son güncelleme: SS:DD, internet yok" şeridi eklenir.

#### H22 — Fotoğraflar internetsiz kuyruğa alınmıyor · P2 · Kodda görüldü
- **Kanıt:** `photo-uploader.tsx` doğrudan yüklüyor; internet yoksa "Yüklenemedi" diyor. Kantar fişi fotoğrafı belirli bir sefere veya araca bağlanamıyor.
- **Çözüm:** IndexedDB kuyruğu (bekleyen fotoğraflar) ve fotoğrafın sefer kaydına bağlanması (`trip_entry_id`).

#### H23 — Tablet ve dizüstünde üst menü taşıyor · P2 · Doğrulandı
- **Kanıt:** 1024 ve 1280 px genişlikte üst menünün içeriği **1416 px**, görünen alan 1024 px. Son öğeler ("Şantiyeler", "Araçlar", "Kullanıcılar") ekranın dışında kalıyor ve erişilemiyor. Kabul testleri yalnızca 390 px telefon genişliğini denetliyor.
- **Kök neden:** `src/app/(app)/nav.tsx`, `DesktopNav` içinde 12 öğe `whitespace-nowrap` ile ve kaydırma olmadan sıralanıyor.
- **Çözüm:** `overflow-x-auto` + gruplama ("Daha fazla" açılır menüsü) veya geniş ekranda yan menü. 768, 1024 ve 1280 px için e2e taşma testi.

#### H24 — İşlem geçmişi eksik · P2 · Kodda görüldü
- **Kanıt:**
  - `audit_log` tetikleyicileri `sites`, `work_items`, kayıt tabloları, `machine_logs` ve `photos` için var.
  - `vehicles` (ücretler!), `routes` (sefer ücreti), `memberships` ve `tenants` için yok.
  - İşlem geçmişini gösteren ekran yok.
- **Çözüm:** Eksik tetikleyiciler ve yönetici için "Kim neyi değiştirdi" ekranı (filtreli).

#### H25 — Kullanıcı ekleme akışı · P2 · Kodda görüldü
- **Kanıt:** `add_member`:
  - kişinin önceden kayıt olmasını şart koşuyor;
  - "Bu e-posta ile kayıtlı kullanıcı yok" mesajıyla herhangi bir e-postanın sistemde olup olmadığını ele veriyor (her kullanıcı kendi firmasını açıp deneyebilir);
  - kişiyi onayı olmadan firmaya ekliyor.
- **Çözüm:**
  - Davet bağlantısı (e-posta veya WhatsApp), kabul ekranı.
  - Saha personeli için telefon numarası ve SMS ile giriş ya da firma kodu + PIN.
  - Mesajlar e-postanın varlığını belli etmeyecek şekilde yazılır.

#### H26 — m³ ve kabarma katsayısı yok · P2 · Kodda görüldü
- **Kanıt:** Araç kapasitesi yalnızca ton (`capacity_ton`). Hafriyat çoğunlukla m³ ile sözleşilir (gevşek ve yerinde hacim farkı = kabarma katsayısı).
- **Çözüm:** Araca `capacity_m3`; iş kalemine "sefer → m³" dönüşümü (kasa hacmi × doluluk × 1/kabarma).

#### H27–H32 — Düşük öncelikli
- **H27:** Supabase performans danışmanı `memberships`, `routes`, `sites`, `vehicles` ve `work_items` için "Multiple Permissive Policies" uyarısı veriyor. Sebep: `*_write` politikalarının `for all` olması. Bunlar `insert/update/delete` olarak ayrılmalı. Kullanılmayan indeks uyarıları veri az olduğu için şimdilik önemsiz.
- **H28:** Hem middleware hem `getContext` `auth.getUser()` çağırıyor; her istekte Auth sunucusuna iki gidiş-dönüş oluyor. `getClaims()` (yerel JWT doğrulama) veya istek başına tek çağrı kullanılmalı.
- **H29:** `report-excel.ts:96` ve `report-pdf.tsx:137` "KDV dahil" toplamı ondalıklı sayıyla topluyor; tutarlılık için `toKurus` kullanılmalı.
- **H30:** Otomatik araç kirası raporda KDV'siz (`report.ts:114`). "KDV dahil toplam" eksik görünüyor; kira için varsayılan KDV oranı alanı eklenmeli.
- **H31:** `create_tenant` sınırsız; kötüye kullanım için kullanıcı başına firma sınırı ve hız sınırı eklenmeli.
- **H32:** İmalat, sefer, gider ve makine kayıtları düzenlenemiyor; yalnızca silinip yeniden giriliyor. Düzenleme, işlem geçmişiyle birlikte eklenmeli.

### 4.6 Test boşlukları

| Boşluk | Sonuç |
|---|---|
| E2E yığınında satır sınırı yok | H02 yakalanmadı |
| E2E Vercel paketlemesini denemiyor | H01 yakalanmadı |
| Çevrimdışı akışta yalnızca mutlu yol testli | H03 yakalanmadı |
| Yalnızca telefon genişliği testli | H23 yakalanmadı |
| RLS testlerinde "saha personeli fiyat okuyamaz" yok | H05 yakalanmadı |
| CI yok | Testler yalnızca elle |

---

## 5. PAZAR ANALİZİ

### 5.1 Rakipler

**A. Türkiye**

| Ürün / sistem | Ne yapıyor | Hafriyol'a göre |
|---|---|---|
| [Sitabula](https://apps.apple.com/pk/app/sitabula/id6757933988) | Şantiye platformu: imalat takibi, saha notu ve fotoğraf, taşeron yönetimi, metraj → hakediş, evrak, stok, sipariş, beton, iş makinesi takibi | Daha geniş (bina/genel inşaat); hafriyat seferine özel değil |
| [HOPS / HOPS Plus](https://apps.apple.com/tr/app/hops/id6747675098) | İş makinesi operatörü puantajı, otomatik hakediş, dijital imza, PDF, KVKK vurgusu | Makine puantajında imza ve hakediş var; sefer ve mazot yok |
| [ŞantiyeX / Buildfy](https://apps.apple.com/ma/app/buildfy/id6743945925) | Maliyet, ödeme, faz ve ekip takibi; taşeron ve tedarikçi kayıtları; ödeme hatırlatma | Cari ve ödeme tarafı güçlü |
| [YapıPro](https://apps.apple.com/us/app/id6741705828) | Yapı denetim odaklı; hakediş listesi, şantiye irsaliye takibi | Farklı segment |
| [Origami](https://origami.sa/tr/sectors/contracting-maintenance/) | Günlük rapor ve fotoğraf, otomatik hakediş raporu | Kurumsal |
| [Uyumsoft İnşaat ERP](https://uyumsoft.com/insaat-erp) | ERP; metraj ve Revit entegrasyonu | Büyük firmalar, mobil değil |
| [Arvento](https://arvento.com/en/web-platform/) | Araç takip; hafriyat kamyonu **damper (kasa) sensörü** | Donanım gerektirir; otomatik döküm tespiti |
| Mobiliz | Araç takip, çoklu sensör | Donanım |
| [Shell TTS](https://multinet.com.tr/blog/lojistik-filo-yonetimi/shell-tasit-tanima-sistemi-ile-filo-yonetimi-kolay-rahat-ve-hizli), [Opet Otobil](https://apps.apple.com/us/app/id1588036735) (UTTS) | Plaka tanıyan akaryakıt alımı, araç bazında litre ve limit raporları | Mazot verisi buradan içe aktarılabilir |
| [İBB hafriyat takip](https://www.gazetevatan.com/gundem/hafriyat-kamyonlarina-arac-takip-sistemi-freni-1236798) | 2018'den beri hafriyat kamyonlarına takip cihazı (8.561 araç); döküm alanı dışına dökümde ve hız ihlalinde alarm | Kamyonlar zaten GPS'li; düzenleyici talep var |
| [Sakarya HYBS](https://www.sakarya.bel.tr/a/Haber/hybs-yazilimiyla-hafriyat-depolama-sahalarinda-tam-kontrol-saglandi/23596) | Döküm için izin belgesi, atık taşıma kabul belgesi ve barkod | Sefer ↔ kabul belgesi eşleştirmesi fırsatı |

**B. Saha ve ekip uygulamaları (global)**

| Ürün | Öne çıkan | Not |
|---|---|---|
| [HCSS HeavyJob](https://www.hcss.com/?p=26160) | Ekip zaman kartları (bir dokunuşla önceki kartı kopyalama), ekip imzası, ekipman saatleri, **bütçeye karşı üretim**, günlük defter ve fotoğraf, internetsiz çalışma; Equipment360 ile bakım talebi ve yakıt aktarımı | Pahalı, öğrenmesi zor |
| [Raken](https://rakenapp.com/daily-reports) | Günlük rapor (hava durumu otomatik, logolu PDF, e-posta), sesle not, taşeronun kendi raporu, iş güvenliği kontrol listeleri, zaman kartı | Yaklaşık 23–59 $/kullanıcı/ay (3. taraf) |
| [Busybusy](https://www.getapp.com/construction-software/a/busybusy/) | GPS'li zaman takibi, ekipman, günlük rapor, fotoğraf | ~9,99 $/kullanıcı/ay'dan |
| [Assignar](https://assignar.com/field-crews/) | Ekip ve makine planlama, zaman çizelgesi, iş başı (pre-start) kontrolleri, araç kontrol listeleri, faturalama | Teklif usulü |
| [SiteBook](https://www.sitebook.com.au/?p=6308) | **Teslim fişi (docket):** tonaj, müşteri imzası, fotoğraf; makine faaliyet kaydı; PDF ile e-posta | Fiş ve imza akışı örnek alınmalı |

**C. Nakliye ve dijital fiş (e-ticketing)**

| Ürün | Öne çıkan |
|---|---|
| [Tread](https://www.forconstructionpros.com/home/product/22899957/tread-dump-truck-dispatch-management) | Damperli kamyon sevk ve dağıtımı (öz mal + taşeron), sahada mobil imzalı kantar fişi, **mükerrer fiş tespiti**, donanımsız GPS, rota geri oynatma, faturalama, API |
| [TruckIT](https://www.forconstructionpros.com/construction-technology/apps/blog/21082926/truckit-app-digitize-hauling-needs-with-truckit-contractor) | Dijital fiş, **TicPic: kantar fişinden OCR**, canlı kamyon konumu |
| [TruckPay](https://softwarefinder.com/fleet-management-software/truckpay) | Elektronik kantar entegrasyonu, GPS, **QR ile yükleme/teslim onayı** |
| [Fast Weigh](https://apps.apple.com/us/app/-/id1452847768), [LoadCount](https://apps.apple.com/us/app/-/id1438431750), Ruckit/[CONNEX](https://mastery.commandalkon.com/i/1376098/0) | Yük sayımı, fiş girişi, faturaya aktarım |
| [SpoilStack](https://play.google.com/store/apps/details?id=com.spoilstack) | **Tek dokunuşla yük kaydı** (bildirimden), internetsiz, makine saat sayacı, sabah e-posta özeti, 5 günlük hava durumu, ekip girişi (fiyat görmeden); ~99 $'dan |

**D. Makine verisi ve ölçüm**

| Ürün | Öne çıkan |
|---|---|
| [Tenna](https://softwareconnect.com/reviews/tenna/) (2026'da John Deere satın aldı) | GPS, motor saati, arıza kodu, bakım, iş maliyeti; 50–500 M$ cirolu firmalar için |
| [Komatsu Smart Construction Fleet](https://www.komatsu.com/en/technology/smart-construction/fleet/) | Marka bağımsız **otomatik yük sayımı**, çevrim süresi analizi; ekskavatöre kova tartısı (retrofit) |
| [Propeller](https://www.propelleraero.com/platform/volume-calculations) | Drone ile kazı/dolgu ve stok hacmi (~3 cm), hakedişte miktar doğrulama, PDF/CSV |

### 5.2 Özellik matrisi

✔ var · ◐ kısmi · ✘ yok

| # | Özellik | Hafriyol | TR yerel | Global saha | Nakliye/fiş | Makine/ölçüm |
|---|---|---|---|---|---|---|
| 1 | Tek dokunuşla sefer sayımı | ✔ | ✘ | ✘ | ✔ (SpoilStack) | ✔ (otomatik) |
| 2 | İnternetsiz çalışma | ◐ (H03) | ? | ✔ | ✔ | — |
| 3 | Dijital sefer fişi: yükleme + döküm onayı, karşı taraf imzası/QR | ✘ | ✘ | ◐ (SiteBook) | ✔ | — |
| 4 | Kantar fişi fotoğrafı | ✔ | ? | ✔ | ✔ | — |
| 5 | Kantar fişi OCR / kantar entegrasyonu | ✘ | ✘ | ✘ | ✔ | — |
| 6 | GPS / bölge (geofence) ile otomatik sefer | ✘ | ◐ (Arvento sensörü) | ◐ | ✔ | ✔ |
| 7 | Mükerrer veya şişirilmiş sefer tespiti | ◐ (çevrim sınırı) | ✘ | ✘ | ✔ (mükerrer fiş) | ✔ |
| 8 | Döküm sahası / kabul belgesi eşleştirme | ✘ | ◐ (belediye) | ✘ | ✘ | ✘ |
| 9 | Makine puantajı: arıza/bekleme/hava kodları, fazla mesai, imza | ◐ (saat + mazot) | ✔ (HOPS) | ✔ | — | ✔ |
| 10 | Yakıt: tank stoğu, TTS/Otobil içe aktarma, makine L/saat | ◐ (L/saat) | ◐ (TTS ayrı) | ◐ | — | ✔ |
| 11 | Bakım ve iş başı kontrol listesi | ✘ | ✘ | ✔ | — | ✔ |
| 12 | Personel puantajı | ✘ | ✔ | ✔ | — | — |
| 13 | Günlük şantiye defteri (hava, olay, fotoğraf, PDF) | ◐ (WhatsApp özeti) | ◐ | ✔ | — | — |
| 14 | Taşeron hakedişi (sefer, gün, saat) | ✔ (H02, H04) | ◐ | ◐ | ✔ (fatura) | — |
| 15 | Kesintiler: mazot, avans, KDV tevkifatı, mutabakat imzası | ✘ | ◐ | — | ◐ | — |
| 16 | İdare hakedişi: yeşil defter, KGM nakliye formülü, fiyat farkı | ✘ | ✔ (masaüstü hakediş programları) | — | — | — |
| 17 | Bütçe/plana karşı gerçekleşen, birim maliyet | ◐ | ◐ | ✔ | ◐ | ✔ |
| 18 | Muhasebe ve e-belge (e-Fatura/e-İrsaliye, Logo/Mikro/Paraşüt) | ✘ (Excel) | ◐ | ✔ (QuickBooks/Sage) | ✔ | — |
| 19 | Telefonla (SMS) giriş, ekip girişi | ✘ | ? | ✔ | ✔ | — |
| 20 | Bildirim (push, sabah/akşam özeti) | ◐ (WhatsApp elle) | ? | ✔ | ✔ | ✔ |
| 21 | Drone hacim doğrulaması | ✘ | ✘ | ◐ | ✘ | ✔ |
| 22 | API / entegrasyon | ✘ | ◐ | ✔ | ✔ | ✔ |
| 23 | Türkçe, Türkiye mevzuatına uygun, uygun fiyat | ✔ | ✔ | ✘ | ✘ | ✘ |

### 5.3 Fiyat örnekleri

- Busybusy: ~9,99 $/kullanıcı/ay'dan.
- Raken: ~23–59 $/kullanıcı/ay (üçüncü taraf kaynaklar, resmî değil).
- SpoilStack: ~99 $'dan.
- HCSS, Tenna, Tread, Assignar: teklif usulü; büyük firmalara yönelik.
- Türkiye'deki rakiplerin herkese açık fiyatı bulunamadı.

### 5.4 Konumlandırma

Türkiye'de **hafriyat seferine özel, donanımsız, Türkçe** bir ürün bulunamadı:
- Türkiye'deki rakipler genel inşaat, puantaj veya ERP odaklı.
- Global rakipler pahalı ve Türkiye mevzuatını bilmiyor.
- Telematik çözümler donanım ve abonelik gerektiriyor.

Hafriyol'un boşluğu:

> "Kamyonu GPS'siz de sayan, kantar fişini sefere bağlayan, kiralık ve taşeron hakedişini kesinti ve tevkifatıyla çıkaran, saha personeline para göstermeyen telefon uygulaması."

Fark yaratacak 5 özellik:
1. **Çift noktalı dijital sefer fişi** (yükleme + döküm onayı, QR/imza) — sayım anlaşmazlıklarını bitirir. Tread ve SiteBook bunu satıyor; Türkiye'de yok.
2. **Kesintili taşeron hakedişi ve mutabakat:** mazot ve avans kesintisi, KDV tevkifatı (yapım işleri 4/10, yük taşımacılığı 2/10), PDF ve onay.
3. **Makine puantajı kodları:** çalıştı / yarım gün / arıza (kira yok) / hava–malzeme beklemesi (kira var) / fazla mesai. Kiralama sözleşmelerindeki gerçek kurallar.
4. **Mazot tankı stoğu + TTS/Otobil içe aktarma:** mazot hırsızlığı ve kaçak tüketim tespiti.
5. **Telefon konumuyla bölge (geofence):** yükleme ve döküm alanına giriş-çıkışla seferi önerme ve doğrulama. Donanım istemez; ileride Arvento/İBB GPS verisiyle doğrulama.

---

## 6. EKSİK ANALİZİ VE YOL HARİTASI

Efor: S (≤2 gün), M (≤1 hafta), L (>1 hafta). Her madde kabul kriteriyle birlikte yapılır.

### Faz 0 — Güven (≈1 hafta, satıştan önce zorunlu)

> **Durum (27.10.2026):** F0-1 … F0-7 tamamlandı, testleri yazıldı ve canlıya gönderildi (K15, K16, K18, K20, T19, T20; GitHub Actions). F0-8 (ücretli plan) ve F0-9 (KVKK) kullanıcı kararı bekliyor.

| # | İş | Efor | Kabul kriteri |
|---|---|---|---|
| F0-1 | H01 PDF düzeltmesi + nft testi + canlı duman testi | S | Canlıda PDF iner; CI'da nft kontrolü |
| F0-2 | H02/H06 toplamların SQL'e taşınması, listelerin sayfalanması; e2e'de `PGRST_DB_MAX_ROWS=1000` | M | 1200 seferle rapor = hakediş = gerçek |
| F0-3 | H03 kuyruk güvenliği (çıkış uyarısı, reddedilenler listesi, her ekranda gönderim, kayıtta firma/kullanıcı) | M | K16 geçer |
| F0-4 | H05 fiyat gizliliği (RLS + arayüz) | M | T20 ve e2e geçer |
| F0-5 | H10 silme metni ve onayı | S | Onay metni sefer sayısını söyler |
| F0-6 | H07 şifre sıfırlama, Auth URL ayarı, sızdırılmış şifre koruması | S | E2E şifre sıfırlama |
| F0-7 | H12 GitHub Actions + hata izleme + yayın sonrası duman testi | S | Her PR'da yeşil CI |
| F0-8 | H11 Supabase Pro + Vercel Pro + yedekten dönüş denemesi | S | Belgelenmiş geri dönüş |
| F0-9 | KVKK: aydınlatma metni, gizlilik politikası, kullanım şartları, yurt dışı aktarım için standart sözleşme (bkz. 7) | S | Kayıt ekranında onay ve bağlantılar |

### Faz 1 — Sahayı kazan (2–4 hafta)

| # | İş | Efor | Kabul kriteri |
|---|---|---|---|
| F1-1 | **Dijital sefer fişi:** fiş no, yükleme saati, döküm saati, döküm yeri, ton/m³, fotoğraf, karşı taraf onayı (QR veya isim + imza); yükleme ve döküm sayımlarını eşleştirme | L | Eşleşmeyen sefer "onaysız" görünür; hakedişte ayrı listelenir |
| F1-2 | Araç–şantiye ataması (H15), araç türü alanı (H20) | S | Sayaçta yalnız atanmış araçlar |
| F1-3 | Vardiya / iş günü başlangıç saati (H08) | M | Gece vardiyası tek gün |
| F1-4 | Ücret geçmişi + dönem kilidi (H04, H19) | M | T19 geçer |
| F1-5 | Makine puantajı kodları (çalıştı / yarım / arıza / bekleme / hava), fazla mesai, günlük garanti saat, operatör imzası | M | Hakediş kurala göre hesaplanır |
| F1-6 | Taşeron hakedişi v2: kesintiler (mazot, avans, hasar), KDV ve tevkifat, önceki ödemeler (kümülatif), mutabakat PDF'i, cari kart (vergi no, IBAN) | L | Örnek hakediş bir mali müşavirle doğrulanır |
| F1-7 | Kantar fişini sefere bağlama, çevrimdışı fotoğraf kuyruğu (H22) | M | Fişsiz seferler listelenir |
| F1-8 | Çift dokunuş koruması ve çift puantör tespiti (H16) | S | Uyarı çıkar |
| F1-9 | Elle imalat / bağlı güzergâh ayrımı (H09), tonsuz sefer uyarısı (H17) | S | Çift sayım imkânsız |
| F1-10 | Kayıt düzenleme + işlem geçmişi ekranı (H24, H32) | M | Kim neyi değiştirdi görünür |
| F1-11 | Masaüstü menüsü (H23) | S | 768/1024/1280 taşma testi |

### Faz 2 — Ofisi kazan (1–3 ay)

| # | İş | Efor |
|---|---|---|
| F2-1 | **Mazot tankı:** alım (fatura) → tank → araç/makine dağıtımı; stok farkı alarmı; Shell TTS / Opet Otobil CSV içe aktarma; plaka eşleştirme | L |
| F2-2 | Saha için telefonla giriş (SMS OTP) veya firma kodu + PIN; davet bağlantısı (H25) | M |
| F2-3 | Bildirimler: akşam gün sonu özeti, eksik fiş/ton, şişirilmiş sefer, norm aşımı (web push + e-posta) | M |
| F2-4 | Günlük şantiye defteri: hava durumu (otomatik), personel/makine sayısı, olaylar, fotoğraf, imzalı PDF | M |
| F2-5 | m³, kasa hacmi, kabarma katsayısı (H26); sefer → m³ imalat | M |
| F2-6 | KGM nakliye formülü (07.005/K – 07.006/K, mesafe M, katsayı K, A) ile taşıma bedeli; ton-km ve m³-km kalemleri | M |
| F2-7 | Bütçe/plana karşı gerçekleşen: iş kalemi bazında maliyet/gelir, öz mal araç maliyeti (mazot + şoför + amortisman) ile araç başı kârlılık | L |
| F2-8 | Firma geneli (tüm şantiyeler) özet paneli | S |

### Faz 3 — Otomasyon ve entegrasyon

| # | İş |
|---|---|
| F3-1 | Telefon konumu ile yükleme/döküm bölgesi (geofence); otomatik sefer önerisi |
| F3-2 | Kantar fişi OCR (fiş no, plaka, tarih, net ağırlık) |
| F3-3 | Araç takip entegrasyonu (Arvento/Mobiliz API veya CSV): damper açılma olayı ile sefer doğrulama |
| F3-4 | e-İrsaliye / e-Fatura entegratörü (gerekiyorsa) |
| F3-5 | Logo / Mikro / Paraşüt'e aktarım (gider, hakediş) |
| F3-6 | Herkese açık API ve webhook |
| F3-7 | Drone hacim verisi (Propeller vb.) ile imalat doğrulama |

---

## 7. HUKUK VE İŞLETME UYUMU

- **KVKK (6698):**
  - Kullanıcılar ve şoförler için aydınlatma metni gerekli.
  - Veriler Supabase ve Vercel üzerinden **Frankfurt'ta (yurt dışı)** işleniyor. 2024 değişikliğiyle yurt dışı aktarımda (yeterlilik kararı yoksa) **standart sözleşme** imzalanıp **5 iş günü içinde Kurul'a bildirilmesi** gerekiyor ([KVKK standart sözleşme bildirimi](https://www.erdem-erdem.av.tr/bilgi-bankasi/standart-sozlesme-bildirim-modulu-hakkinda-kamuoyu-duyurusu)). Yaptırım: idari para cezası.
  - VERBİS kaydı yükümlülüğü değerlendirilmeli.
  - Veri silme ve dışa aktarma talepleri için süreç gerekli.
- **Vergi:**
  - Taşeron hakedişinde KDV tevkifatı: yapım işlerinde 4/10, yük taşımacılığında 2/10 ([kaynak](https://www.muhasebetr.com/yazarlarimiz/fuattekgul/014)).
  - Uygulama "bilgi amaçlı hesap" olarak sunulmalı; kesin oran mali müşavirle doğrulanmalı.
- **e-İrsaliye:**
  - Genel eşik: 10 milyon TL brüt satış ([kaynak](https://sovos.com/tr/blog/kdv/e-irsaliye-uygulamasina-zorunlu-gecis-siniri-10-milyon-tl-oldu/)).
  - Hafriyat nakliyesine özel bir kural bulunamadı; müşteriler için mali müşavir görüşü alınmalı.
- **Barındırma:**
  - Supabase ücretsiz plan → Pro.
  - Vercel Hobby (ticari olmayan kullanım) → Pro.
  - Yedekleme ve geri dönüş planı.
- **Belediye mevzuatı:** Hafriyat toprağı taşıma ve döküm süreçleri (taşıma kabul belgesi, döküm sahası) il bazında değişir (İBB, Sakarya HYBS). Ürün bu belgelerin numarasını sefere bağlayabilmeli.

---

## 8. GÖREV (yapay zekâya talimat)

1. Önce bu belgeyi ve `docs/01-mimari-plan.md`, `README.md`, `supabase/migrations/*` dosyalarını oku. Bölüm 3'teki kurallara uy.
2. **Faz 0'dan başla. Sıra:** F0-1 → F0-2 → F0-3 → F0-4 → F0-5 → F0-6 → F0-7. (F0-8 ve F0-9 kullanıcı kararı ve hesabı gerektirir; bunlar için kullanıcıya ne yapacağını adım adım yaz.)
3. Her iş için:
   - (a) Hatayı gösteren testi yaz ve kırmızı olduğunu göster.
   - (b) En küçük düzeltmeyi yap.
   - (c) Bölüm 3/5'teki komutların hepsini çalıştır.
   - (d) Kısa bir özet yaz: değişen dosyalar, eklenen testler, komut çıktıları.
4. Veritabanı değişikliği gerekiyorsa yeni bir migration dosyası yaz (DROP yok). RLS testini (`supabase/tests/rls_test.sql`) genişlet.
5. Emin olmadığın iş kuralında (ör. günlük kiranın iki şantiyeye paylaştırılması, tevkifat oranı) **varsayım yapma**: seçenekleri ve önerini yazıp kullanıcıya sor.
6. Faz 0 bitince Faz 1'e geçmeden önce kullanıcıdan onay iste.
7. Çıktı biçimi: Her iş için şu başlıklarla Markdown:
   - "Ne değişti"
   - "Neden"
   - "Test kanıtı" (komut + sonuç satırı)
   - "Kullanıcının yapması gereken" (varsa)

---

## 9. TEST PLANI (eklenecek testler)

| Kimlik | Tür | Senaryo |
|---|---|---|
| K15 | e2e | 10 kiralık kamyon × 12 gün × 10 sefer: rapor, hakediş, giderler ve kayıtlar toplamı = 1200 sefer / 1.080.000 TL (`PGRST_DB_MAX_ROWS=1000`) |
| K16 | e2e | İnternetsiz 3 sefer → çıkış: uyarı, kayıp yok. Reddedilen kayıt "gönderilemeyenler"de. Başka ekrandayken bağlantı gelince gönderim |
| K17 | e2e | Saha personeli şantiye, araç ve rapor ekranlarında "₺" görmez |
| K18 | e2e | 12 seferlik kayıtta silme onayı "12 sefer" der |
| K19 | e2e | Şifre sıfırlama uçtan uca |
| K20 | e2e | 768/1024/1280 px'de menü ve sayfalar taşmaz |
| T19 | RLS | Kilitli döneme ekleme, düzeltme ve silme reddedilir |
| T20 | RLS | Saha personeli fiyat ve ücret sütunlarını okuyamaz |
| U-vardiya | birim | 22:00–04:00 seferleri tek iş günü, tek gün kira |
| U-paylaştırma | birim | İki şantiyede çalışan araçta günlük kira bir kez sayılır |
| B-nft | build | `rapor/pdf` izinde `pdfkit/js/standard-fonts/Helvetica.cjs` var |
| Duman | canlı | Yayından sonra giriş, rapor, Excel ve PDF 200 döner |

---

## 10. KAYNAKLAR

**Canlı sistem kanıtları:**
- Vercel çalışma zamanı hataları (`/rapor/pdf`, 25.10.2026).
- Supabase güvenlik ve performans danışmanı (27.10.2026).
- Yerel yeniden üretme sonuçları (27.10.2026).

**Pazar ve mevzuat:**
- Türkiye uygulamaları: [Sitabula](https://apps.apple.com/pk/app/sitabula/id6757933988) · [HOPS](https://apps.apple.com/tr/app/hops/id6747675098) · [HOPS Plus](https://apps.apple.com/tr/app/hops-plus/id6748928650) · [Buildfy](https://apps.apple.com/ma/app/buildfy/id6743945925) · [YapıPro](https://apps.apple.com/us/app/id6741705828) · [Origami](https://origami.sa/tr/sectors/contracting-maintenance/) · [Uyumsoft İnşaat ERP](https://uyumsoft.com/insaat-erp)
- Araç takip ve akaryakıt: [Arvento](https://arvento.com/en/web-platform/) · [Mobiliz](https://mobiliz.com.tr/en/?p=481) · [Shell TTS](https://multinet.com.tr/blog/lojistik-filo-yonetimi/shell-tasit-tanima-sistemi-ile-filo-yonetimi-kolay-rahat-ve-hizli) · [Opet Otobil](https://apps.apple.com/us/app/id1588036735)
- Belediye sistemleri: [İBB hafriyat takip](https://www.gazetevatan.com/gundem/hafriyat-kamyonlarina-arac-takip-sistemi-freni-1236798) · [İBB kaçak döküm cezası](https://emlakkulisi.com/ibbden-kacak-hafriyat-dokumune-ceza/529438) · [Sakarya HYBS](https://www.sakarya.bel.tr/a/Haber/hybs-yazilimiyla-hafriyat-depolama-sahalarinda-tam-kontrol-saglandi/23596)
- Saha uygulamaları: [HCSS HeavyJob](https://www.hcss.com/?p=26160) · [Raken](https://rakenapp.com/daily-reports) · [Raken fiyat (Capterra)](https://www.capterra.com/p/153591/RAKEN/pricing/) · [Busybusy](https://www.getapp.com/construction-software/a/busybusy/pricing/) · [Assignar](https://assignar.com/field-crews/) · [SiteBook](https://www.sitebook.com.au/?p=6308)
- Nakliye ve fiş: [Tread](https://www.forconstructionpros.com/home/product/22899957/tread-dump-truck-dispatch-management) · [TruckIT](https://www.forconstructionpros.com/construction-technology/apps/blog/21082926/truckit-app-digitize-hauling-needs-with-truckit-contractor) · [TruckPay](https://softwarefinder.com/fleet-management-software/truckpay) · [Fast Weigh](https://apps.apple.com/us/app/-/id1452847768) · [LoadCount](https://apps.apple.com/us/app/-/id1438431750) · [SpoilStack](https://play.google.com/store/apps/details?id=com.spoilstack)
- Makine verisi ve ölçüm: [Tenna](https://softwareconnect.com/reviews/tenna/) · [Komatsu Smart Construction](https://www.komatsu.com/en/technology/smart-construction/fleet/) · [Propeller](https://www.propelleraero.com/platform/volume-calculations)
- Mevzuat ve sözleşme: [Makine kiralama sözleşmesi örneği](https://av-saimincekas.com/sozlesme-hukuku/is-makinasi-kiralama-sozlesmesi/) · [KGM nakliye formülü örneği](https://birimfiyat.com/pdf/49412) · [KDV tevkifatı](https://www.muhasebetr.com/yazarlarimiz/fuattekgul/014) · [e-İrsaliye eşiği](https://sovos.com/tr/blog/kdv/e-irsaliye-uygulamasina-zorunlu-gecis-siniri-10-milyon-tl-oldu/) · [KVKK standart sözleşme](https://www.erdem-erdem.av.tr/bilgi-bankasi/standart-sozlesme-bildirim-modulu-hakkinda-kamuoyu-duyurusu) · [Supabase proje duraklatma](https://supabase.com/docs/guides/platform/free-project-pausing)

> Not: Rakip özellikleri çoğunlukla üreticilerin kendi tanıtım sayfalarından ve uygulama mağazası açıklamalarından alındı; satın alma veya karşılaştırma kararından önce demo ile doğrulanmalıdır.
