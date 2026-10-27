# Hafriyol

[![Kontroller](https://github.com/bahadirdogus23-ui/Ara-takip/actions/workflows/ci.yml/badge.svg)](https://github.com/bahadirdogus23-ui/Ara-takip/actions/workflows/ci.yml)

Küçük ve orta ölçekli yol, altyapı ve hafriyat firmaları için şantiye imalat, sefer,
gider ve dönem raporu takip uygulaması.

**Canlı adres:** https://hafriyol.vercel.app (Vercel, Frankfurt). Bu dala yapılan her gönderim otomatik yayınlanır.

**Durum:** Aşama 3 tamam. Veritabanı Supabase'te (`hafriyol` projesi, Frankfurt). Öne çıkanlar:

- Tek dokunuşla sefer sayacı; **internet yokken de çalışır** (telefonda bekler, bağlantı gelince gönderilir); isteğe bağlı her seferde **kantar tonu**
- Güzergâh bir iş kalemine bağlanınca seferler **kendiliğinden imalat tutarına** dönüşür (sefer × birim fiyat veya kantar tonu × birim fiyat)
- Kiralık / taşeron araçların **günlük, saatlik veya sefer başı kirası giderlere ve rapora kendiliğinden** yazılır
- Şişirilmiş sefer uyarısı (güzergâh çevrim süresine göre günlük azami sefer)
- İş makinesi saati ve mazot, yakıt normu aşımı uyarısı
- **Taşeron / kiralık araç hakedişi** (sefer × güzergâh ücreti, saat × saatlik ücret, Excel)
- Kantar fişi, saha ve hasar **fotoğrafları** (telefonda küçültülüp yüklenir, firmaya özel)
- WhatsApp'a tek dokunuşla gün sonu raporu (para tutarı içermez)
- Bir dakikalık kurulum (hazır hafriyat/yol iş kalemleri, plakaları alt alta yazma)
- Dönem raporu, Excel ve PDF (makineler dahil)
- Telefona uygulama gibi kurulur (Ana ekrana ekle)

- Mimari plan, ekranlar, riskler, kabul testleri: [`docs/01-mimari-plan.md`](docs/01-mimari-plan.md)
- Hata analizi, rakip analizi ve yol haritası (yapay zekâya verilecek prompt): [`docs/02-hata-ve-pazar-analizi.md`](docs/02-hata-ve-pazar-analizi.md)
- Veritabanı şeması (taslak): [`supabase/migrations/`](supabase/migrations/)
- Veritabanı testleri: [`supabase/tests/`](supabase/tests/)

## Uygulamayı çalıştırma

Node.js 20 veya üzeri gerekir.

```bash
npm install
cp .env.example .env.local   # Supabase adresi ve herkese açık anahtar hazır
npm run dev                  # http://localhost:3000
```

Kontroller:

```bash
npm run lint        # kod kuralları
npm run typecheck   # TypeScript tip kontrolü
npm test            # doğrulama, hesap, Excel ve PDF testleri (PDF testi pdftotext ister)
npm run test:db     # veritabanı güvenlik ve hesap testleri (PostgreSQL gerekir)
npm run build       # canlıya çıkacak derleme + PDF paketinde eksik dosya denetimi
```

### Supabase ayarı (bir kez)

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://hafriyol.vercel.app`
- **Redirect URLs:** `https://hafriyol.vercel.app/auth/callback**` ve yerel geliştirme için `http://localhost:3000/auth/callback**` (sondaki `**`, şifre yenileme dönüşündeki `?sonra=/sifre-yenile` için gerekli)
- **Leaked password protection:** açık (Authentication → Policies)

Bu yapılmazsa e-posta doğrulama ve şifre yenileme bağlantıları uygulamaya dönmez.

### Abonelik ve davet kodu

- Yeni firma "ödeme bekliyor" açılır; sahip ödeme ekranından bildirim yapar. Hafriyol yöneticisi
  `/yonetim` ekranından firmayı aktif eder (1 ay / 1 yıl / süresiz) veya askıya alır.
- Ödeme ekranındaki bilgiler Vercel ortam değişkenlerinden gelir: `HAFRIYOL_ODEME_TUTAR`,
  `HAFRIYOL_ODEME_IBAN`, `HAFRIYOL_ODEME_ALICI`, `HAFRIYOL_ILETISIM`.
- Çalışanlar kayıt olup "Davet kodum var" ile katılır. Firma sahibi her rol için, yönetici
  (mühendis) yalnızca saha personeli için kod üretir (Kullanıcılar ekranı).

Her gönderimde GitHub Actions lint, tip kontrolü, birim, veritabanı ve kabul testlerini çalıştırır (`.github/workflows/ci.yml`).

## Klasörler

```
src/app/(auth)/        giriş, kayıt, çıkış
src/app/firma-olustur/ ilk firma
src/app/(app)/         oturum gerektiren sayfalar: Bugün, sefer sayacı, kayıt gir,
                       makine/mazot, fotoğraflar, kayıtlar, giderler, rapor (Excel/PDF),
                       taşeron hakedişi, şantiyeler, araçlar, kullanıcılar, hızlı kurulum
src/lib/               Supabase bağlantısı, doğrulama kuralları, Türkçe sayı,
                       kuruş hesabı, biçimlendirme
assets/fonts/          PDF'e gömülen Noto Sans (SIL Open Font License, OFL.txt)
public/sw.js           internetsiz çalışma (service worker); simgeler public/icons
supabase/              veritabanı şeması ve testleri
tests/                 birim testleri
```

## Uçtan uca (tarayıcı) testleri

Supabase'in yerel bir kopyası (PostgreSQL + Supabase Auth + PostgREST) Docker olmadan başlatılır,
uygulama ona bağlanır ve kabul testleri telefon ekran boyutunda çalışır:

```bash
./scripts/e2e-storage-build.sh  # bir kez: fotoğraf servisi (Supabase Storage) kaynaktan derlenir
./scripts/e2e-stack.sh        # ilk seferde Auth ve PostgREST ikili dosyalarını indirir
npm run test:e2e              # K1–K20 kabul testleri (PostgREST, Supabase gibi en fazla 1000 satır döndürür)
./scripts/e2e-stack.sh stop
```

Gerçek Supabase projesine hiç dokunmaz.

## Veritabanı testlerini çalıştırma

PostgreSQL 15 veya üzeri kurulu olmalı:

```bash
./scripts/test-db.sh
```

Betik geçici bir veritabanı açar, şemayı uygular ve firma ayrımı, rol yetkileri, veri
doğrulama ve hesap testlerini çalıştırır. Hepsi geçerse son satırda
`TÜM VERİTABANI TESTLERİ GEÇTİ` yazar.
