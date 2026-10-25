# Hafriyol

Küçük ve orta ölçekli yol, altyapı ve hafriyat firmaları için şantiye imalat, sefer,
gider ve dönem raporu takip uygulaması.

**Canlı adres:** https://hafriyol.vercel.app (Vercel, Frankfurt). Bu dala yapılan her gönderim otomatik yayınlanır.

**Durum:** Aşama 2 tamam. Öne çıkanlar:

- Tek dokunuşla sefer sayacı, şişirilmiş sefer uyarısı (güzergâh çevrim süresine göre)
- İş makinesi saati ve mazot, yakıt normu aşımı uyarısı
- WhatsApp'a tek dokunuşla gün sonu raporu (para tutarı içermez)
- Bir dakikalık kurulum (hazır hafriyat/yol iş kalemleri, plakaları alt alta yazma)
- Dönem raporu, Excel ve PDF (makineler dahil) Veritabanı Supabase'te (`hafriyol` projesi, Frankfurt).

- Mimari plan, ekranlar, riskler, kabul testleri: [`docs/01-mimari-plan.md`](docs/01-mimari-plan.md)
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
npm run build       # canlıya çıkacak derleme
```

### Supabase ayarı (bir kez)

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://hafriyol.vercel.app`
- **Redirect URLs:** `https://hafriyol.vercel.app/auth/callback` ve yerel geliştirme için `http://localhost:3000/auth/callback`

Bu yapılmazsa kayıttan sonra gelen e-posta doğrulama bağlantısı uygulamaya dönmez.

## Klasörler

```
src/app/(auth)/        giriş, kayıt, çıkış
src/app/firma-olustur/ ilk firma
src/app/(app)/         oturum gerektiren sayfalar: panel, günlük giriş, kayıtlar,
                       giderler, rapor (Excel/PDF), şantiyeler (iş kalemi, güzergâh), araçlar
src/lib/               Supabase bağlantısı, doğrulama kuralları, Türkçe sayı,
                       kuruş hesabı, biçimlendirme
assets/fonts/          PDF'e gömülen Noto Sans (SIL Open Font License, OFL.txt)
supabase/              veritabanı şeması ve testleri
tests/                 birim testleri
```

## Uçtan uca (tarayıcı) testleri

Supabase'in yerel bir kopyası (PostgreSQL + Supabase Auth + PostgREST) Docker olmadan başlatılır,
uygulama ona bağlanır ve kabul testleri telefon ekran boyutunda çalışır:

```bash
./scripts/e2e-stack.sh        # ilk seferde Auth ve PostgREST ikili dosyalarını indirir
npm run test:e2e              # K1–K10 kabul testleri
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
