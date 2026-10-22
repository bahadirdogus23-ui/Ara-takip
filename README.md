# Hafriyol

Küçük ve orta ölçekli yol, altyapı ve hafriyat firmaları için şantiye imalat, sefer,
gider ve dönem raporu takip uygulaması.

**Durum:** Planlama aşaması. Veritabanı Supabase'e kuruldu (`hafriyol` projesi, Frankfurt), uygulama kodu henüz yok.

- Mimari plan, ekranlar, riskler, kabul testleri: [`docs/01-mimari-plan.md`](docs/01-mimari-plan.md)
- Veritabanı şeması (taslak): [`supabase/migrations/`](supabase/migrations/)
- Veritabanı testleri: [`supabase/tests/`](supabase/tests/)

## Veritabanı testlerini çalıştırma

PostgreSQL 15 veya üzeri kurulu olmalı:

```bash
./scripts/test-db.sh
```

Betik geçici bir veritabanı açar, şemayı uygular ve firma ayrımı, rol yetkileri, veri
doğrulama ve hesap testlerini çalıştırır. Hepsi geçerse son satırda
`TÜM VERİTABANI TESTLERİ GEÇTİ` yazar.
