# Hafriyol: Mimari Plan (İlk Görev Çıktısı)

> Durum: **Taslak.** Bu belge kod yazmadan önceki planı tanımlar. Veritabanı şeması
> (`supabase/migrations/`) yerel PostgreSQL 16 üzerinde test edildi ve Supabase'teki
> `hafriyol` projesine (Frankfurt, ücretsiz plan) uygulandı.

## 1. Ürün özeti

Küçük ve orta ölçekli yol, altyapı ve hafriyat yüklenicileri için bir web uygulaması.
Şantiyedeki günlük imalat, araç seferi ve gider kayıtları tek yerde toplanır. Dönem
özetleri ve Excel/PDF raporları birkaç tıklamayla alınır.

**İlk sürümde YOK:** resmî hakediş mevzuatı hesapları (fiyat farkı, kesintiler vb.),
çevrimdışı çalışma, mobil mağaza uygulaması, muhasebe entegrasyonu, yapay zekâ
özellikleri, birim dönüşümü ve ödeme/abonelik altyapısı.

## 2. Teknoloji ve mimari

```
Tarayıcı / telefon
      │  (HTTPS)
      ▼
Next.js (App Router, TypeScript), Vercel üzerinde
  • Sunucu bileşenleri ve Server Actions: tüm okuma/yazma burada
  • Form doğrulama: Zod (aynı şema hem istemcide hem sunucuda)
  • Excel: exceljs · PDF: sunucuda @react-pdf/renderer
      │  (kullanıcının oturum çerezi ile)
      ▼
Supabase
  • Auth: e-posta + şifre (ilk sürüm)
  • PostgreSQL: tablolar + RLS politikaları + özet fonksiyonları
  • İşlem geçmişi: veritabanı tetikleyicileri
```

**Neden bu yapı:**

- **Güvenlik iki katmanlı.** Next.js sunucusu kullanıcının kendi oturumuyla Supabase'e
  bağlanır. Bu yüzden kodda bir hata olsa bile veritabanındaki RLS kuralları başka
  firmanın verisini göstermez.
- **`service_role` anahtarı istemciye hiç gitmez.** Sadece sunucu tarafında, sadece
  zorunlu yönetim işlerinde kullanılır. İlk sürümde hiç gerekmeyebilir.
- **Hesaplar veritabanında yapılır.** Para ve miktar hesapları `numeric` tipiyle SQL'de
  yapılır. JavaScript'in ondalık hatalarına (0.1 + 0.2 ≠ 0.3) maruz kalmaz.
  Arayüz bu sonuçları sadece biçimlendirir.
- **Tek uygulama, tek veritabanı, çok firma (multi-tenant).** Her kayıtta `tenant_id`
  bulunur.

## 3. Kullanıcı rolleri

| Rol | Kim | Yetkiler |
| --- | --- | --- |
| `owner` | Firma sahibi | Her şey. Kullanıcı davet etme ve rol değiştirme de dahil. |
| `manager` | Şantiye şefi, ofis | Şantiye, iş kalemi, araç ve güzergâh tanımları. Tüm kayıtlar, giderler, raporlar. |
| `field` | Saha personeli, puantör | İmalat ve sefer girişi. Sadece kendi kaydını düzeltir. **Giderleri göremez.** |

Bilinen sınır: `field` rolü firmanın tüm şantiyelerini ve iş kalemi birim fiyatlarını
görebilir. Şantiye bazlı atama ve fiyat gizleme 2. sürüme bırakıldı (bkz. Riskler).

## 4. Veri modeli

Dosya: `supabase/migrations/20261022000000_initial_schema.sql`

| Tablo | Amaç | Önemli alanlar |
| --- | --- | --- |
| `tenants` | Firma | ad, vergi no |
| `memberships` | Kullanıcı ↔ firma ↔ rol | tenant_id, user_id, role |
| `sites` | Şantiye | ad, kod, işveren, konum, başlangıç/bitiş, durum |
| `work_items` | Şantiyeye özel iş kalemi (poz) | poz no, ad, birim, birim fiyat, planlanan miktar |
| `vehicles` | Araç / iş makinesi | plaka (firma içinde benzersiz), tür, mülkiyet, kapasite |
| `routes` | Şantiyeye özel güzergâh | ad, nereden, nereye, km |
| `production_entries` | Günlük imalat | tarih, iş kalemi, miktar, not |
| `trip_entries` | Araç seferi | tarih, araç, güzergâh, sefer sayısı, tonaj |
| `expenses` | Gider | tarih, kategori, tutar (KDV hariç), KDV %, tedarikçi, isteğe bağlı iş kalemi |
| `audit_log` | İşlem geçmişi | tablo, kayıt, işlem, eski/yeni veri, kim, ne zaman |

**Veri bütünlüğü kuralları:**

- **Bileşik yabancı anahtarlar.** Örneğin `(work_item_id, tenant_id, site_id)`. Bir imalat
  kaydı başka firmanın ya da başka şantiyenin iş kalemine bağlanamaz.
- **`client_request_id`.** Form iki kez gönderilirse (çift tıklama, zayıf internet) ikinci
  kayıt reddedilir.
- **`created_by`.** İstemci ne gönderirse göndersin, oturumdaki kullanıcıya zorlanır.
- **Değer kontrolleri.** Miktar > 0, tutar > 0, sefer sayısı 1–500 arası, birim izinli
  listeden (`m, m2, m3, ton, kg, adet, lt, km, saat, gun, sefer`), bitiş tarihi ≥
  başlangıç tarihi.
- **Para alanları.** `numeric(14,2)` (TL, kuruş hassasiyetinde). Miktarlar
  `numeric(16,3)`.
- **Gider kategorileri.** Mazot, işçilik, malzeme, taşeron, ekipman kirası, bakım, diğer.

## 5. Hesap formülleri

Hepsi `production_summary` ve `expense_summary` fonksiyonlarında, seçilen şantiye ve
tarih aralığı için hesaplanır:

| Değer | Formül | Yuvarlama |
| --- | --- | --- |
| Dönem miktarı | Σ imalat miktarı | Yok (3 hane saklanır) |
| Tutar | miktar × birim fiyat | 2 hane |
| Gerçekleşme % | miktar ÷ planlanan miktar × 100 | 2 hane |
| Doğrudan gider | Σ o iş kalemine bağlanmış gider (KDV hariç) | Yok |
| Birim maliyet | doğrudan gider ÷ miktar | 2 hane |
| KDV | Her satırda ayrı ayrı: tutar × KDV% ÷ 100, sonra toplanır | Satır başına 2 hane |

**Bilinçli karar:** İş kalemine bağlanmamış genel giderler (ör. şantiye mazotunun
tamamı) birim maliyete **otomatik dağıtılmaz**. Dağıtım anahtarı firmaya göre
değişir. Yanlış bir varsayım, yanlış maliyet göstermek demektir. Bu giderler gider
özetinde ayrıca görünür.

## 6. Ekran listesi

| # | Ekran | Rol | İçerik |
| --- | --- | --- | --- |
| 1 | Giriş / Kayıt / Şifre sıfırlama | herkes | Supabase Auth |
| 2 | Firma oluştur | yeni kullanıcı | İlk girişte firma adı ister, kullanıcıyı owner yapar |
| 3 | Ana panel | herkes | Şantiye kartları; bu ayki imalat tutarı, gider ve son kayıtlar |
| 4 | Şantiye listesi / detay | owner, manager | Ekle, düzenle, durum değiştir |
| 5 | İş kalemleri | owner, manager | Şantiyeye özel poz listesi; Excel'den yapıştırma (2. aşama) |
| 6 | Araçlar ve güzergâhlar | owner, manager | Plaka, tür, kapasite; güzergâh ve km |
| 7 | **Günlük giriş (mobil öncelikli)** | herkes | Tarih + şantiye seçimi, sonra hızlı imalat ve sefer formu |
| 8 | İmalat kayıtları listesi | herkes | Filtre (şantiye, tarih, iş kalemi), düzenle, sil |
| 9 | Sefer kayıtları listesi | herkes | Filtre (araç, güzergâh, tarih) |
| 10 | Giderler | owner, manager | Liste, ekle, kategori filtresi |
| 11 | Dönem raporu | owner, manager | Tarih aralığı; imalat özeti, gider özeti, Excel/PDF indir |
| 12 | Kullanıcılar | owner | Davet et, rol değiştir, çıkar |
| 13 | İşlem geçmişi | owner, manager | Kim, neyi, ne zaman değiştirdi |

Ekran 7 en önemli ekrandır. Sahada telefonla, eldivenle, güneş altında kullanılacak.
Bu yüzden büyük düğmeler, az alan ve son kullanılan iş kalemi ile aracın hatırlanması
gerekir.

## 7. Riskler

| Risk | Etki | Önlem |
| --- | --- | --- |
| RLS politikası hatası nedeniyle firmalar arası veri sızıntısı | **Çok yüksek.** Ürün biter. | Her tablo için otomatik test (`scripts/test-db.sh`). Yeni tablo eklenince test de eklenecek. |
| `service_role` anahtarının sızması | Çok yüksek | Sadece sunucu ortam değişkeninde tutulur, `NEXT_PUBLIC_` önekiyle asla kullanılmaz. |
| Yanlış hesap, yanlış hakediş tutarı | Yüksek | Formüller SQL'de ve testli. "Resmî hakediş değildir" uyarısı gösterilir. |
| Şantiyede internet yok | Orta | İlk sürümde internet zorunlu. Pilotta ölçülecek. Gerekirse 2. sürümde çevrimdışı kuyruk eklenir. |
| Saha personeli birim fiyatları görüyor | Orta | 2. sürümde şantiye ataması ve fiyat gizleme gelecek. |
| Owner'ın kendi rolünü düşürmesi, firmanın sahipsiz kalması | Düşük | Uygulama tarafında "son owner'ı kaldıramazsın" kontrolü eklenecek. |
| Kullanıcıların Excel alışkanlığı | Yüksek (satış) | İçe aktarma ve Excel çıktısı önceliklidir. Ekranlar Excel kadar hızlı olmalıdır. |
| Rakipler mevcut | Yüksek (satış) | Türkiye'de genel şantiye uygulamaları var (ör. Sitabula, ŞantiyeX). Odak: Türkçe, yol/hafriyat özelinde, sefer ve imalat ağırlıklı, sade, ucuz. Müşteri görüşmeleri koddan önce. |
| Şantiye-M zorunluluğu | Orta | Bakanlığın Şantiye-M uygulaması 1 Ocak 2026'dan itibaren zorunlu bir şantiye defteri. Hafriyol onun yerine geçmez, ama aynı verinin iki kez girilmemesi için ilerde dışa aktarma ve uyum incelenmeli. |
| Yedek / veri kaybı | Yüksek | Supabase günlük yedek (ücretli plan). Pilot öncesi geri yükleme denemesi yapılacak. |
| Kamu görevlisi olarak ticari faaliyet | Hukuki | Kurum kaynağı kullanılmaz. Ücretli satıştan önce mevzuat ve etik kurallar netleştirilir. |

## 8. İlk çalışan sürümün kabul testleri

### Veritabanı (otomatik, şimdi çalışıyor: `./scripts/test-db.sh`)

| Test | Beklenen | Durum |
| --- | --- | --- |
| T1 | B firması A'nın firmasını, şantiyesini, iş kalemini ve özetini göremez | ✅ |
| T2 | B, A firmasına şantiye ekleyemez | ✅ |
| T3 | B kendini A firmasına üye yapamaz | ✅ |
| T4 | Başka firmanın iş kalemine imalat bağlanamaz | ✅ |
| T5 | Saha personeli imalat ve sefer girer, gider göremez, şantiye açamaz | ✅ |
| T6 | Aynı form iki kez gönderilince ikinci kayıt reddedilir | ✅ |
| T7 | Negatif miktar ve geçersiz birim reddedilir | ✅ |
| T8 | `created_by` sahte gönderilemez | ✅ |
| T9 | 120,5 + 79,5 m³ × 85,50 TL = 17.100,00 TL; gerçekleşme %2,00; birim maliyet 15,00 TL/m³; 1.234,56 TL'nin %20 KDV'si 246,91 TL | ✅ |
| T10 | Kayıtlar işlem geçmişine yazılır, kullanıcı geçmişi silemez | ✅ |
| T11 | Oturum açmamış kullanıcı hiçbir tabloyu okuyamaz | ✅ |
| T12 | Eski yetki yardımcıları API'den çağrılamaz | ✅ |

### Uygulama (sonraki görevlerde yazılacak, Playwright ile)

- [ ] **K1.** Yeni kullanıcı kayıt olur, firma oluşturur, ana panele düşer.
- [ ] **K2.** Owner bir şantiye, iki iş kalemi ve bir araç tanımlar.
- [ ] **K3.** Telefon ekran boyutunda (390 px) günlük imalat kaydı 30 saniyeden kısa
      sürede girilir. Yatay kaydırma olmaz.
- [ ] **K4.** Boş veya hatalı form gönderilince alan altında Türkçe hata mesajı çıkar.
      Kayıt oluşmaz.
- [ ] **K5.** Kayıt düğmesine hızlıca iki kez basılınca tek kayıt oluşur.
- [ ] **K6.** Saha kullanıcısı menüde "Giderler"i görmez. URL'yi elle yazınca da
      erişemez.
- [ ] **K7.** Dönem raporundaki toplamlar T9'daki örnek veriyle birebir aynıdır.
      Excel dosyası açılır ve aynı toplamları içerir.
- [ ] **K8.** İki farklı tarayıcıda iki farklı firma ile girilince birbirlerinin
      verisi hiçbir ekranda görünmez.

## 9. Geliştirme sırası (4 haftalık plana uyarlanmış)

1. **Hafta 1:** Next.js iskeleti, Supabase bağlantısı, giriş/kayıt, firma oluşturma
   (K1), şantiye ekranı (K2'nin bir kısmı). Supabase projesine migration uygulanır.
2. **Hafta 2:** İş kalemleri, araçlar, güzergâhlar, günlük giriş ekranı, kayıt
   listeleri, giderler (K2–K6).
3. **Hafta 3:** Dönem raporu, Excel ve PDF çıktısı (K7).
4. **Hafta 4:** Telefon testleri, yetki testleri (K8), yedekten geri yükleme
   denemesi, pilot kullanıcı.

## 10. Ürün adı: Hafriyol

**Hafriyat + yol.** Hedef müşterinin iki ana işini tek kelimede söylüyor. Türkiye'de
akılda kalmış "-yol" ile biten marka kalıbını da çağrıştırıyor.

- Türkçe karakter yok (ş, ı, ğ). Alan adı, e-posta ve uygulama mağazasında sorun çıkmaz.
- 3 hece, telefonda söylenince yanlış yazılmaz.
- Arama sonuçlarında aynı adda ürün çıkmadı.
- Önceki geçici ad "ŞantiyeCep" App Store'da başka bir uygulamaya ait olduğu için
  bırakıldı.

Satışa çıkmadan önce yapılacaklar: `hafriyol.com` ve `hafriyol.com.tr` alan adlarının
alınması, TÜRKPATENT'te marka araştırması (sınıf 9 ve 42).

## 11. Eski projeden alınacak fikirler (2. sürüm adayları)

Daha önce yazılan "Kırsal Yol Bakım ve Şantiye Yönetim Sistemi" projesinden kod
alınmadı, sadece fikirler not edildi. O proje bir kuruma özeldi; Hafriyol yeni ve
bağımsız bir üründür. Kurum verisi kullanılmaz.

| Fikir | Neden değerli |
| --- | --- |
| **Şişirilmiş sefer denetimi** | Güzergâh km'si ve çevrim süresine göre bir aracın bir günde yapabileceği en fazla sefer hesaplanır. Fazlası işaretlenir. Taşeron kamyon ödemelerinde doğrudan para kazandırır; güçlü bir satış argümanı. |
| **Kantar / hızlı sefer girişi** | Plaka seç, tek dokunuşla +1 sefer. Saha personeli için en hızlı ekran. |
| **Geçerlilik tarihli fiyatlar** | Mazot, şoför yevmiyesi gibi fiyatlar değişince eski satır değiştirilmez, yeni tarihli satır eklenir. Geriye dönük raporlar doğru kalır. |
| **Yakıt norm kontrolü** | Araç başına beklenen tüketimin dışına çıkan mazot kaydı kırmızı gösterilir. |
| **Bakım / muayene / sigorta hatırlatmaları** | Filo sahibi firmalar için günlük kullanım sebebi olur. |
| **Çevrimdışı kayıt** | Şantiyede çekim yoksa kayıt telefonda bekler, internet gelince gönderilir. Pilotta ihtiyaç ölçülecek. |

## 12. Karar bekleyen konular

1. **Pilot firma.** Hafta 4 için en az bir gönüllü firma gerekiyor.
2. **Eski yetki fonksiyonlarının silinmesi.** `public.is_member` ve `public.has_role`
   artık kullanılmıyor ve çağrılamıyor. Silmek için Supabase'te onay gerekiyor;
   zararsız oldukları için bir sonraki migration'a bırakıldı.
