# Hafriyol

Küçük ve orta ölçekli yol, altyapı ve hafriyat firmaları için şantiye imalat, sefer,
gider ve dönem raporu takip uygulaması.

**Durum:** 3. hafta: dönem raporu ile Excel ve PDF çıktısı hazır (önceki haftalar: giriş, firma, şantiye, iş kalemi, araç, günlük giriş, kayıtlar, giderler). Veritabanı Supabase'te (`hafriyol` projesi, Frankfurt).

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

- **Site URL:** canlı adres (şimdilik `http://localhost:3000`)
- **Redirect URLs:** `http://localhost:3000/auth/callback` ve canlı adresin `/auth/callback` yolu

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

## Veritabanı testlerini çalıştırma

PostgreSQL 15 veya üzeri kurulu olmalı:

```bash
./scripts/test-db.sh
```

Betik geçici bir veritabanı açar, şemayı uygular ve firma ayrımı, rol yetkileri, veri
doğrulama ve hesap testlerini çalıştırır. Hepsi geçerse son satırda
`TÜM VERİTABANI TESTLERİ GEÇTİ` yazar.
