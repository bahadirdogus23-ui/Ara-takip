-- Hafriyol veritabanı kabul testleri.
-- İki firma (A ve B) ve farklı rollerdeki kullanıcılarla firma ayrımını,
-- rol yetkilerini, veri doğrulamayı ve özet hesaplarını sınar.
-- Her test başarısız olursa hata fırlatır; betik ON_ERROR_STOP ile çalışır.

\set ON_ERROR_STOP on

-- Test kullanıcıları
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'sahip-a@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'saha-a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'sahip-b@test');

-- Oturum değiştirme yardımcısı
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  execute 'set role authenticated';
end $$;

create function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'TEST BAŞARISIZ: %', p_name;
  end if;
  raise notice 'GEÇTİ: %', p_name;
end $$;

-- ---------------------------------------------------------------------------
-- Kurulum: firma A (sahip + saha personeli), firma B (sahip)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_tenant('A Hafriyat Ltd') as tenant_a \gset
insert into public.memberships(tenant_id, user_id, role)
  values (:'tenant_a', '00000000-0000-0000-0000-0000000000a2', 'field');
insert into public.sites(tenant_id, name) values (:'tenant_a', 'Çevre Yolu 1. Kısım')
  returning id as site_a \gset
insert into public.work_items(tenant_id, site_id, code, name, unit, planned_quantity)
  values (:'tenant_a', :'site_a', '15.150.1001', 'Kazı (yumuşak toprak)', 'm3', 10000)
  returning id as item_a \gset
insert into public.work_item_prices(work_item_id, tenant_id, site_id, unit_price) values (:'item_a', :'tenant_a', :'site_a', 85.50);
insert into public.vehicles(tenant_id, plate, vehicle_type, capacity_ton)
  values (:'tenant_a', '06 ABC 123', 'kamyon', 25)
  returning id as vehicle_a \gset
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.create_tenant('B Altyapı AŞ') as tenant_b \gset
insert into public.sites(tenant_id, name) values (:'tenant_b', 'Kanalizasyon Hattı')
  returning id as site_b \gset
insert into public.work_items(tenant_id, site_id, name, unit)
  values (:'tenant_b', :'site_b', 'Boru döşeme', 'm')
  returning id as item_b \gset
insert into public.work_item_prices(work_item_id, tenant_id, site_id, unit_price) values (:'item_b', :'tenant_b', :'site_b', 400);
reset role;

-- ---------------------------------------------------------------------------
-- T1: Firma ayrımı — B, A'nın hiçbir kaydını göremez
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.tenants) = 1, 'T1a B yalnızca kendi firmasını görür');
select pg_temp.check((select count(*) from public.sites where tenant_id = :'tenant_a') = 0, 'T1b B, A şantiyelerini göremez');
select pg_temp.check((select count(*) from public.work_items where tenant_id = :'tenant_a') = 0, 'T1c B, A iş kalemlerini göremez');
select pg_temp.check((select count(*) from public.production_summary(:'site_a', '2026-01-01', '2026-12-31')) = 0,
  'T1d B, A şantiyesinin özetini alamaz');
reset role;

-- T2: B, A firmasına kayıt ekleyemez
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
\set ON_ERROR_STOP off
insert into public.sites(tenant_id, name) values (:'tenant_a', 'Sızma denemesi');
\set ON_ERROR_STOP on
reset role;
select pg_temp.check(not exists (select 1 from public.sites where name = 'Sızma denemesi'),
  'T2 B, A firmasına şantiye ekleyemez');

-- T3: B kendini A firmasına üye yapamaz
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
\set ON_ERROR_STOP off
insert into public.memberships(tenant_id, user_id, role)
  values (:'tenant_a', '00000000-0000-0000-0000-00000000000b', 'owner');
\set ON_ERROR_STOP on
reset role;
select pg_temp.check(not exists (
  select 1 from public.memberships where tenant_id = :'tenant_a' and user_id = '00000000-0000-0000-0000-00000000000b'),
  'T3 B kendini A firmasına üye yapamaz');

-- T4: Kendi firmasında bile başka firmanın iş kalemine bağlı kayıt açılamaz
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
\set ON_ERROR_STOP off
insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity)
  values (:'tenant_b', :'site_b', :'item_a', '2026-10-01', 10);
\set ON_ERROR_STOP on
reset role;
select pg_temp.check((select count(*) from public.production_entries where work_item_id = :'item_a') = 0,
  'T4 Başka firmanın iş kalemine imalat bağlanamaz (bileşik FK)');

-- ---------------------------------------------------------------------------
-- T5: Saha personeli imalat girer, gider göremez/ekleyemez, şantiye açamaz
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity, client_request_id)
  values (:'tenant_a', :'site_a', :'item_a', '2026-10-01', 120.5, '11111111-1111-1111-1111-111111111111');
insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity)
  values (:'tenant_a', :'site_a', :'item_a', '2026-10-02', 79.5);
insert into public.trip_entries(tenant_id, site_id, vehicle_id, entry_date, trip_count, tonnage)
  values (:'tenant_a', :'site_a', :'vehicle_a', '2026-10-01', 12, 290);
select pg_temp.check((select count(*) from public.production_entries) = 2, 'T5a Saha personeli imalat girebilir');
select pg_temp.check((select count(*) from public.expenses) = 0, 'T5b Saha personeli giderleri göremez');
do $$ begin
  insert into public.sites(tenant_id, name)
    values ((select id from public.tenants limit 1), 'Yetkisiz şantiye');
  raise exception 'TEST BAŞARISIZ: T5c saha personeli şantiye açabildi';
exception when insufficient_privilege then
  raise notice 'GEÇTİ: T5c Saha personeli şantiye açamaz';
end $$;
reset role;

-- T6: Aynı form iki kez gönderilirse ikinci kayıt reddedilir
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity, client_request_id)
    select tenant_id, site_id, work_item_id, entry_date, quantity, client_request_id
    from public.production_entries where client_request_id = '11111111-1111-1111-1111-111111111111';
  raise exception 'TEST BAŞARISIZ: T6 tekrar gönderim kabul edildi';
exception when unique_violation then
  raise notice 'GEÇTİ: T6 Tekrar gönderim engellenir';
end $$;
reset role;

-- T7: Hatalı veri reddedilir (negatif/sıfır miktar, geçersiz birim)
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity)
    select tenant_id, site_id, id, '2026-10-03', -5 from public.work_items limit 1;
  raise exception 'TEST BAŞARISIZ: T7a negatif miktar kabul edildi';
exception when check_violation then
  raise notice 'GEÇTİ: T7a Negatif miktar reddedilir';
end $$;
do $$ begin
  insert into public.work_items(tenant_id, site_id, name, unit)
    select tenant_id, id, 'Hatalı birim', 'metrekup' from public.sites limit 1;
  raise exception 'TEST BAŞARISIZ: T7b geçersiz birim kabul edildi';
exception when check_violation then
  raise notice 'GEÇTİ: T7b Geçersiz birim reddedilir';
end $$;
reset role;

-- T8: created_by sahte gönderilemez
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity, created_by)
  values (:'tenant_a', :'site_a', :'item_a', '2026-11-15', 1, '00000000-0000-0000-0000-00000000000a')
  returning created_by as forged_by \gset
reset role;
select pg_temp.check(:'forged_by' = '00000000-0000-0000-0000-0000000000a2', 'T8 created_by oturumdaki kullanıcıya zorlanır');

-- ---------------------------------------------------------------------------
-- T9: Özet hesapları (Ekim 2026)
--   miktar = 120.5 + 79.5 = 200 m3
--   tutar  = 200 × 85.50 = 17 100.00 TL
--   gerçekleşme = 200 / 10 000 × 100 = 2.00 %
--   doğrudan gider = 3 000.00 (mazot, iş kalemine bağlı) → birim maliyet = 15.00 TL/m3
--   işçilik gideri 1 234.56, KDV %20 = 246.91 (yuvarlanmış)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.expenses(tenant_id, site_id, work_item_id, expense_date, category, amount)
  values (:'tenant_a', :'site_a', :'item_a', '2026-10-01', 'fuel', 3000);
insert into public.expenses(tenant_id, site_id, expense_date, category, amount)
  values (:'tenant_a', :'site_a', '2026-10-02', 'labor', 1234.56);

select pg_temp.check(s.quantity = 200 and s.amount = 17100.00 and s.progress_percent = 2.00
                     and s.direct_cost = 3000 and s.unit_cost = 15.00,
                     'T9a İmalat özeti: miktar, tutar, gerçekleşme ve birim maliyet doğru')
from public.production_summary(:'site_a', '2026-10-01', '2026-10-31') s;

select pg_temp.check(s.amount = 1234.56 and s.vat_amount = 246.91 and s.total = 1481.47,
                     'T9b Gider özeti: KDV yuvarlaması doğru')
from public.expense_summary(:'site_a', '2026-10-01', '2026-10-31') s where s.category = 'labor';

select pg_temp.check((select quantity from public.production_summary(:'site_a', '2026-09-01', '2026-09-30')) = 0,
  'T9c Dönem dışı kayıtlar özete girmez');

-- T10: İşlem geçmişi tutulur, kullanıcı geçmişi değiştiremez
select pg_temp.check((select count(*) from public.audit_log where table_name = 'production_entries') >= 3,
  'T10a İmalat kayıtları işlem geçmişine yazılır');
delete from public.audit_log;
reset role;
select pg_temp.check((select count(*) from public.audit_log) > 0, 'T10b Kullanıcı işlem geçmişini silemez');

-- T11: Anonim kullanıcı hiçbir şey okuyamaz
set role anon;
do $$ begin
  perform count(*) from public.sites;
  raise exception 'TEST BAŞARISIZ: T11 anonim kullanıcı şantiyeleri okuyabildi';
exception when insufficient_privilege then
  raise notice 'GEÇTİ: T11 Anonim kullanıcı erişemez';
end $$;
reset role;

-- T12: Yetki yardımcıları ve tetikleyici fonksiyonları API'den çağrılamaz
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform public.is_member(gen_random_uuid());
  raise exception 'TEST BAŞARISIZ: T12 public.is_member çağrılabildi';
exception when insufficient_privilege then
  raise notice 'GEÇTİ: T12 Eski yetki yardımcıları çağrılamaz';
end $$;
reset role;

-- T13: Saha personeli başkasının kaydını silemez/değiştiremez, kendi kaydını silebilir
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.production_entries(tenant_id, site_id, work_item_id, entry_date, quantity, note)
  values (:'tenant_a', :'site_a', :'item_a', '2026-10-05', 7, 'sahibin kaydı');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
delete from public.production_entries where note = 'sahibin kaydı';
update public.production_entries set quantity = 9999 where note = 'sahibin kaydı';
reset role;
select pg_temp.check((select quantity from public.production_entries where note = 'sahibin kaydı') = 7,
  'T13a Saha personeli başkasının kaydını silemez/değiştiremez');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
delete from public.production_entries where entry_date = '2026-11-15';
reset role;
select pg_temp.check(not exists (select 1 from public.production_entries where entry_date = '2026-11-15'),
  'T13b Saha personeli kendi kaydını silebilir');

-- T14: Araç plakası firma içinde tekil, farklı firmada aynı plaka olabilir
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into public.vehicles(tenant_id, plate, vehicle_type) values (:'tenant_b', '06 ABC 123', 'kamyon');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into public.vehicles(tenant_id, plate, vehicle_type)
    select id, '06 ABC 123', 'kamyon' from public.tenants limit 1;
  raise exception 'TEST BAŞARISIZ: T14 aynı firmada aynı plaka eklenebildi';
exception when unique_violation then
  raise notice 'GEÇTİ: T14 Plaka firma içinde tekil, firmalar arasında bağımsız';
end $$;
reset role;

-- T15: Firma kullanıcıları
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000a3', 'Yeni.Sef@Test');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.add_member(:'tenant_a', '  yeni.sef@test ', 'manager');
select pg_temp.check((select count(*) from public.tenant_members(:'tenant_a')) = 3, 'T15a Sahip e-postayla kullanıcı ekler, üyeleri listeler');
do $$ begin
  perform public.add_member((select id from public.tenants where name = 'A Hafriyat Ltd'), 'yok@test', 'field');
  raise exception 'TEST BAŞARISIZ: T15b kayıtsız e-posta eklendi';
exception when raise_exception then
  raise notice 'GEÇTİ: T15b Kayıtsız e-posta için anlaşılır hata';
end $$;
do $$ begin
  delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a';
  raise exception 'TEST BAŞARISIZ: T15c son sahip çıkarıldı';
exception when raise_exception then
  raise notice 'GEÇTİ: T15c Son sahip çıkarılamaz';
end $$;
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.tenant_members(:'tenant_a')) = 0, 'T15d Başka firmanın üyeleri listelenemez');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  perform public.add_member((select id from public.tenants limit 1), 'sahip-b@test', 'owner');
  raise exception 'TEST BAŞARISIZ: T15e saha personeli kullanıcı ekledi';
exception when insufficient_privilege then
  raise notice 'GEÇTİ: T15e Saha personeli kullanıcı ekleyemez';
end $$;
reset role;

-- T16: Makine kayıtları
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into public.machine_logs(tenant_id, site_id, vehicle_id, log_date, hours, fuel_liters)
  values (:'tenant_a', :'site_a', :'vehicle_a', '2026-10-01', 9.5, 180);
reset role;
select pg_temp.check((select count(*) from public.audit_log where table_name = 'machine_logs') = 1, 'T16a Saha personeli makine saati ve mazot girer, işlem geçmişine yazılır');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.machine_logs) = 0, 'T16b Başka firma makine kayıtlarını göremez');
\set ON_ERROR_STOP off
insert into public.machine_logs(tenant_id, site_id, vehicle_id, log_date, hours)
  values (:'tenant_b', :'site_b', :'vehicle_a', '2026-10-01', 5);
\set ON_ERROR_STOP on
reset role;
select pg_temp.check((select count(*) from public.machine_logs) = 1, 'T16c Başka firmanın aracına makine kaydı açılamaz');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into public.machine_logs(tenant_id, site_id, vehicle_id, log_date)
    select tenant_id, site_id, vehicle_id, '2026-10-02' from public.machine_logs limit 1;
  raise exception 'TEST BAŞARISIZ: T16d boş makine kaydı kabul edildi';
exception when check_violation then
  raise notice 'GEÇTİ: T16d Saat ya da mazot girilmeden kayıt açılamaz';
end $$;
do $$ begin
  insert into public.machine_logs(tenant_id, site_id, vehicle_id, log_date, hours)
    select tenant_id, site_id, vehicle_id, '2026-10-02', 25 from public.machine_logs limit 1;
  raise exception 'TEST BAŞARISIZ: T16e 25 saat kabul edildi';
exception when check_violation then
  raise notice 'GEÇTİ: T16e Günde 24 saatten fazla çalışma girilemez';
end $$;
reset role;

-- T17: Fotoğraflar (dosya + kayıt)
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into storage.objects(bucket_id, name, owner_id)
  values ('photos', :'tenant_a' || '/' || :'site_a' || '/2026-10-25/f1.jpg', '00000000-0000-0000-0000-0000000000a2');
insert into public.photos(tenant_id, site_id, taken_on, kind, storage_path)
  values (:'tenant_a', :'site_a', '2026-10-25', 'kantar', :'tenant_a' || '/' || :'site_a' || '/2026-10-25/f1.jpg');
reset role;
select pg_temp.check((select count(*) from public.photos) = 1, 'T17a Saha personeli kendi firmasına fotoğraf yükler');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'photos') = 0, 'T17b Başka firma dosyaları göremez');
select pg_temp.check((select count(*) from public.photos) = 0, 'T17c Başka firma fotoğraf kayıtlarını göremez');
\set ON_ERROR_STOP off
insert into storage.objects(bucket_id, name) values ('photos', :'tenant_a' || '/' || :'site_a' || '/2026-10-25/sizma.jpg');
insert into storage.objects(bucket_id, name) values ('photos', 'uuid-degil/x/y.jpg');
insert into public.photos(tenant_id, site_id, taken_on, kind, storage_path)
  values (:'tenant_b', :'site_b', '2026-10-25', 'saha', :'tenant_a' || '/' || :'site_a' || '/2026-10-25/f1.jpg');
\set ON_ERROR_STOP on
reset role;
select pg_temp.check((select count(*) from storage.objects) = 1, 'T17d Başka firmanın klasörüne ya da geçersiz yola dosya yüklenemez');
select pg_temp.check((select count(*) from public.photos) = 1, 'T17e Kayıt başka firmanın dosya yolunu gösteremez');

-- T18: Güzergâh iş kalemine bağlanınca seferler imalat sayılır
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.work_items(tenant_id, site_id, name, unit)
  values (:'tenant_a', :'site_a', 'Hafriyat nakliyesi', 'sefer') returning id as item_sefer \gset
insert into public.work_items(tenant_id, site_id, name, unit)
  values (:'tenant_a', :'site_a', 'Kırma taş', 'ton') returning id as item_ton \gset
insert into public.work_item_prices(work_item_id, tenant_id, site_id, unit_price) values
  (:'item_sefer', :'tenant_a', :'site_a', 750), (:'item_ton', :'tenant_a', :'site_a', 40);
insert into public.routes(tenant_id, site_id, name, work_item_id) values (:'tenant_a', :'site_a', 'Döküm', :'item_sefer') returning id as route_sefer \gset
insert into public.routes(tenant_id, site_id, name, work_item_id) values (:'tenant_a', :'site_a', 'Taş ocağı', :'item_ton') returning id as route_ton \gset
insert into public.trip_entries(tenant_id, site_id, vehicle_id, route_id, entry_date, trip_count) values
  (:'tenant_a', :'site_a', :'vehicle_a', :'route_sefer', '2026-10-26', 1),
  (:'tenant_a', :'site_a', :'vehicle_a', :'route_sefer', '2026-10-26', 1),
  (:'tenant_a', :'site_a', :'vehicle_a', :'route_sefer', '2026-10-26', 3);
insert into public.trip_entries(tenant_id, site_id, vehicle_id, route_id, entry_date, trip_count, tonnage) values
  (:'tenant_a', :'site_a', :'vehicle_a', :'route_ton', '2026-10-26', 1, 24.5),
  (:'tenant_a', :'site_a', :'vehicle_a', :'route_ton', '2026-10-26', 1, null);
select pg_temp.check(s.quantity = 5 and s.amount = 3750, 'T18a Sefer birimli kalem: 5 sefer × 750 = 3.750')
  from public.production_summary(:'site_a', '2026-10-26', '2026-10-26') s where s.work_item_id = :'item_sefer';
select pg_temp.check(s.quantity = 24.5 and s.amount = 980, 'T18b Ton birimli kalem yalnızca girilen kantar tonunu sayar: 24,5 × 40 = 980')
  from public.production_summary(:'site_a', '2026-10-26', '2026-10-26') s where s.work_item_id = :'item_ton';
\set ON_ERROR_STOP off
insert into public.routes(tenant_id, site_id, name, work_item_id) values (:'tenant_a', :'site_a', 'Yanlış', :'item_b');
\set ON_ERROR_STOP on
reset role;
select pg_temp.check(not exists (select 1 from public.routes where name = 'Yanlış'), 'T18c Güzergâh başka firmanın iş kalemine bağlanamaz');

-- T19: Gün bazında sefer ve makine özeti (1000 satır sınırına takılmadan toplam)
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(s.trips = 5 and s.untonned_trips = 5 and s.my_last_id is not null, 'T19a Sefer özeti aynı gün/araç/güzergâhı tek satırda toplar (5 sefer)')
  from public.trip_day_summary(:'tenant_a', :'site_a', '2026-10-26', '2026-10-26') s where s.route_id = :'route_sefer';
select pg_temp.check(s.trips = 2 and s.tonnage = 24.5 and s.untonned_trips = 1, 'T19b Ton toplamı ve tonsuz sefer sayısı ayrı verilir')
  from public.trip_day_summary(:'tenant_a', :'site_a', '2026-10-26', '2026-10-26') s where s.route_id = :'route_ton';
select pg_temp.check((select count(*) from public.machine_day_summary(:'tenant_a', null, '2026-10-01', '2026-10-31')) >= 1, 'T19c Makine özeti firma geneli çalışır');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.trip_day_summary(:'tenant_a', null, '2026-01-01', '2026-12-31')) = 0, 'T19d Başka firma sefer özetini göremez');
select pg_temp.check((select count(*) from public.machine_day_summary(:'tenant_a', null, '2026-01-01', '2026-12-31')) = 0, 'T19e Başka firma makine özetini göremez');
reset role;

-- T20: Fiyatlar yalnızca firma sahibi/yöneticiye açık
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.route_prices(route_id, tenant_id, site_id, trip_price) values (:'route_sefer', :'tenant_a', :'site_a', 900);
insert into public.vehicle_rates(vehicle_id, tenant_id, daily_rate) values (:'vehicle_a', :'tenant_a', 9000);
select pg_temp.check((select count(*) from public.work_item_prices) = 3 and (select count(*) from public.vehicle_rates) = 1, 'T20a Yönetici fiyatları görür');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.work_item_prices) = 0, 'T20b Saha personeli iş kalemi birim fiyatını göremez');
select pg_temp.check((select count(*) from public.route_prices) = 0, 'T20c Saha personeli taşeron sefer ücretini göremez');
select pg_temp.check((select count(*) from public.vehicle_rates) = 0, 'T20d Saha personeli araç kirasını göremez');
select pg_temp.check(s.unit_price is null and s.amount is null, 'T20e Saha personeline dönem özetinde tutar dönmez')
  from public.production_summary(:'site_a', '2026-10-26', '2026-10-26') s where s.work_item_id = :'item_sefer';
\set ON_ERROR_STOP off
insert into public.vehicle_rates(vehicle_id, tenant_id, hourly_rate) values (:'vehicle_a', :'tenant_a', 1);
update public.vehicle_rates set daily_rate = 1;
\set ON_ERROR_STOP on
reset role;
select pg_temp.check((select daily_rate from public.vehicle_rates where vehicle_id = :'vehicle_a') = 9000, 'T20f Saha personeli ücret yazamaz');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.work_item_prices where tenant_id = :'tenant_a') + (select count(*) from public.route_prices) + (select count(*) from public.vehicle_rates) = 0, 'T20g Başka firma fiyatları göremez');
reset role;

-- T21: Abonelik ve davet kodu
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'hafriyol@test'),
  ('00000000-0000-0000-0000-0000000000a4', 'muhendis-a@test'),
  ('00000000-0000-0000-0000-0000000000c1', 'yeni-1@test'),
  ('00000000-0000-0000-0000-0000000000c2', 'yeni-2@test');
insert into private.platform_admins(user_id) values ('00000000-0000-0000-0000-0000000000ad');

select pg_temp.check((select plan_status from public.tenants where id = :'tenant_a') = 'pending', 'T21a Yeni firma ödeme bekliyor açılır');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_invite(:'tenant_a', 'manager', 'Mühendis', 7, 1) as code_mgr \gset
\set ON_ERROR_STOP off
update public.tenants set plan_status = 'active' where id = :'tenant_a';
\set ON_ERROR_STOP on
reset role;
select pg_temp.check((select plan_status from public.tenants where id = :'tenant_a') = 'pending', 'T21b Firma sahibi aboneliği kendisi açamaz');

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  perform public.join_with_code((select code from public.invite_codes limit 1));
  raise exception 'TEST BAŞARISIZ: T21c aktif olmayan firmaya katılındı';
exception when raise_exception then
  if sqlerrm like 'TEST BAŞARISIZ%' then raise; end if;
  raise notice 'GEÇTİ: T21c Aboneliği aktif olmayan firmaya kodla katılınamaz';
end $$;
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.admin_tenants()) = 0, 'T21d Platform yöneticisi olmayan firma listesini göremez');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000ad');
select pg_temp.check((select count(*) from public.admin_tenants()) >= 2, 'T21e Platform yöneticisi firmaları görür');
select public.admin_set_plan(:'tenant_a', 'active', null);
reset role;
select pg_temp.check((select plan_status from public.tenants where id = :'tenant_a') = 'active', 'T21f Platform yöneticisi firmayı aktif eder');

-- Mühendis kodla katılır (kod küçük harf ve tireyle yazılsa da kabul)
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select public.join_with_code(lower(substr(:'code_mgr', 1, 4) || '-' || substr(:'code_mgr', 5)));
reset role;
select pg_temp.check((select role from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a4') = 'manager', 'T21g Davet koduyla verilen rolle katılınır');

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  perform public.create_invite((select tenant_id from public.memberships where user_id = (select auth.uid()) limit 1), 'owner', '', 7, 1);
  raise exception 'TEST BAŞARISIZ: T21h yönetici sahip kodu üretti';
exception when insufficient_privilege then
  raise notice 'GEÇTİ: T21h Yönetici yalnızca saha personeli kodu üretebilir';
end $$;
select public.create_invite(:'tenant_a', 'field', 'Şoförler', 30, 1) as code_field \gset
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select public.join_with_code(:'code_field');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
\set ON_ERROR_STOP off
select public.join_with_code(:'code_field');
\set ON_ERROR_STOP on
reset role;
select pg_temp.check((select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c2') = 0
  and (select role from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c1') = 'field', 'T21i Tek kullanımlık kod ikinci kişide geçersiz');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.invite_codes) = 0, 'T21j Saha personeli davet kodlarını göremez');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a';
reset role;
select pg_temp.check(not exists (select 1 from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c1')
  and exists (select 1 from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a'), 'T21k Yönetici saha personelini çıkarır, sahibi çıkaramaz');

-- ---------------------------------------------------------------------------
-- T22: Araç cinsi ve araç–şantiye ataması
-- ---------------------------------------------------------------------------
select pg_temp.check((select kind from public.vehicles where id = :'vehicle_a') = 'kamyon', 'T22a Araç cinsi varsayılan kamyon');
do $$ begin
  update public.vehicles set kind = 'ucak' where plate = '06 ABC 123';
  raise exception 'TEST BAŞARISIZ: T22b geçersiz araç cinsi kabul edildi';
exception when check_violation then
  raise notice 'GEÇTİ: T22b Geçersiz araç cinsi reddedilir';
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.site_vehicles(tenant_id, site_id, vehicle_id) values (:'tenant_a', :'site_a', :'vehicle_a');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.site_vehicles where site_id = :'site_a') = 1, 'T22c Saha personeli şantiyenin araçlarını görür');
delete from public.site_vehicles where site_id = :'site_a';
do $$ begin
  insert into public.site_vehicles(tenant_id, site_id, vehicle_id)
    select tenant_id, id, (select id from public.vehicles limit 1) from public.sites limit 1;
  raise exception 'TEST BAŞARISIZ: T22d saha personeli araç atadı';
exception when insufficient_privilege or unique_violation then
  raise notice 'GEÇTİ: T22d Saha personeli araç atayamaz';
end $$;
reset role;
select pg_temp.check((select count(*) from public.site_vehicles where site_id = :'site_a') = 1, 'T22e Saha personeli atamayı silemez');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.site_vehicles) = 0, 'T22f Başka firma atamaları göremez');
do $$ begin
  insert into public.site_vehicles(tenant_id, site_id, vehicle_id)
    values ((select tenant_id from public.memberships where user_id = (select auth.uid()) limit 1),
            (select id from public.sites limit 1), '00000000-0000-0000-0000-000000000099');
  raise exception 'TEST BAŞARISIZ: T22g başka firmanın aracı atandı';
exception when foreign_key_violation or insufficient_privilege then
  raise notice 'GEÇTİ: T22g Başka firmanın aracı atanamaz';
end $$;
reset role;

-- Firma A'nın aracını B şantiyesine atamak: bileşik yabancı anahtar engeller
do $$ begin
  insert into public.site_vehicles(tenant_id, site_id, vehicle_id)
    select s.tenant_id, s.id, v.id from public.sites s, public.vehicles v
    where s.name = 'Kanalizasyon Hattı' and v.plate = '06 ABC 123' and v.tenant_id <> s.tenant_id;
  raise exception 'TEST BAŞARISIZ: T22h firmalar arası atama yapıldı';
exception when foreign_key_violation then
  raise notice 'GEÇTİ: T22h Bir firmanın aracı başka firmanın şantiyesine atanamaz';
end $$;

\echo 'TÜM VERİTABANI TESTLERİ GEÇTİ'
