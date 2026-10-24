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
insert into public.work_items(tenant_id, site_id, code, name, unit, unit_price, planned_quantity)
  values (:'tenant_a', :'site_a', '15.150.1001', 'Kazı (yumuşak toprak)', 'm3', 85.50, 10000)
  returning id as item_a \gset
insert into public.vehicles(tenant_id, plate, vehicle_type, capacity_ton)
  values (:'tenant_a', '06 ABC 123', 'kamyon', 25)
  returning id as vehicle_a \gset
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.create_tenant('B Altyapı AŞ') as tenant_b \gset
insert into public.sites(tenant_id, name) values (:'tenant_b', 'Kanalizasyon Hattı')
  returning id as site_b \gset
insert into public.work_items(tenant_id, site_id, name, unit, unit_price)
  values (:'tenant_b', :'site_b', 'Boru döşeme', 'm', 400)
  returning id as item_b \gset
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

\echo 'TÜM VERİTABANI TESTLERİ GEÇTİ'
