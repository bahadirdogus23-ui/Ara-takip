-- Supabase Data API bir sorguda en fazla 1000 satır döndürür (fazlası hata vermeden kesilir).
-- Sayaç her dokunuşu ayrı satır yazdığı için rapor, hakediş ve listeler birkaç günde eksik
-- kalıyordu. Bu fonksiyonlar seferleri ve makine kayıtlarını veritabanında gün bazında toplar;
-- istemci sonucu sıralı olarak sayfa sayfa (range) okur.
-- security invoker: çağıranın RLS kuralları geçerlidir. Yalnızca yeni fonksiyon; veri değişmez.

create or replace function public.trip_day_summary(p_tenant uuid, p_site uuid, p_from date, p_to date)
returns table (
  site_id        uuid,
  vehicle_id     uuid,
  route_id       uuid,
  entry_date     date,
  trips          bigint,
  tonnage        numeric,   -- girilen kantar tonu toplamı
  untonned_trips bigint,    -- tonu girilmemiş seferler
  last_at        timestamptz,
  last_id        uuid,      -- gruptaki en son kayıt
  last_count     integer,
  my_last_id     uuid,      -- çağıranın girdiği en son kayıt (saha personeli yalnız bunu silebilir)
  my_last_count  integer,
  notes          text[]
)
language sql stable
set search_path = ''
as $$
  select te.site_id, te.vehicle_id, te.route_id, te.entry_date,
         sum(te.trip_count)::bigint,
         coalesce(sum(te.tonnage), 0),
         sum(case when te.tonnage is null then te.trip_count else 0 end)::bigint,
         max(te.created_at),
         (array_agg(te.id order by te.created_at desc, te.id desc))[1],
         (array_agg(te.trip_count order by te.created_at desc, te.id desc))[1],
         (array_agg(te.id order by te.created_at desc, te.id desc) filter (where te.created_by = (select auth.uid())))[1],
         (array_agg(te.trip_count order by te.created_at desc, te.id desc) filter (where te.created_by = (select auth.uid())))[1],
         coalesce(array_agg(te.note order by te.created_at desc) filter (where te.note is not null), '{}')
  from public.trip_entries te
  where te.tenant_id = p_tenant
    and (p_site is null or te.site_id = p_site)
    and te.entry_date between p_from and p_to
  group by te.site_id, te.vehicle_id, te.route_id, te.entry_date
  order by te.entry_date desc, te.site_id, te.vehicle_id, te.route_id nulls last;
$$;

create or replace function public.machine_day_summary(p_tenant uuid, p_site uuid, p_from date, p_to date)
returns table (
  site_id      uuid,
  vehicle_id   uuid,
  log_date     date,
  hours        numeric,
  fuel_liters  numeric,
  paired_hours numeric,   -- saat ve mazotun birlikte girildiği kayıtlar (L/saat hesabı için)
  paired_fuel  numeric
)
language sql stable
set search_path = ''
as $$
  select ml.site_id, ml.vehicle_id, ml.log_date,
         coalesce(sum(ml.hours), 0),
         coalesce(sum(ml.fuel_liters), 0),
         coalesce(sum(ml.hours) filter (where ml.hours > 0 and ml.fuel_liters > 0), 0),
         coalesce(sum(ml.fuel_liters) filter (where ml.hours > 0 and ml.fuel_liters > 0), 0)
  from public.machine_logs ml
  where ml.tenant_id = p_tenant
    and (p_site is null or ml.site_id = p_site)
    and ml.log_date between p_from and p_to
  group by ml.site_id, ml.vehicle_id, ml.log_date
  order by ml.log_date desc, ml.site_id, ml.vehicle_id;
$$;

revoke execute on function public.trip_day_summary(uuid, uuid, date, date) from public, anon;
revoke execute on function public.machine_day_summary(uuid, uuid, date, date) from public, anon;
grant execute on function public.trip_day_summary(uuid, uuid, date, date) to authenticated;
grant execute on function public.machine_day_summary(uuid, uuid, date, date) to authenticated;
