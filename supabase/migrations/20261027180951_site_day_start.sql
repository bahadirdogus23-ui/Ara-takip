-- F1-3: iş günü başlangıç saati (H08). Gece vardiyası çalışan şantiyede ör. 06:00 seçilirse
-- 06:00'dan önceki seferler önceki iş gününe yazılır; vardiya iki güne bölünmez ve
-- kiralık araca iki günlük kira çıkmaz. Varsayılan 0 (gece yarısı): mevcut davranış değişmez.
alter table public.sites
  add column day_start_hour smallint not null default 0
  check (day_start_hour between 0 and 12);
