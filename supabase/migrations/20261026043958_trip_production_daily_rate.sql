-- Kullanıcı geri bildirimi:
-- 1) Kiralık kamyonlar genelde günlük kiralanır: araca günlük kira.
-- 2) Seferler gelire dönüşmüyordu: güzergâh bir iş kalemine bağlanınca o güzergâhtaki
--    seferler kendiliğinden imalat sayılır (birimi "sefer" ise sefer sayısı, "ton" ise
--    girilen kantar tonu). Böylece işverenden alınan birim fiyat tutara yansır.
-- Yalnızca ekleme ve fonksiyon güncellemesi; veri silinmez.

alter table public.vehicles
  add column daily_rate numeric(12, 2) check (daily_rate >= 0);

alter table public.routes
  add column work_item_id uuid;
alter table public.routes
  add constraint routes_work_item_fkey foreign key (work_item_id, tenant_id, site_id)
  references public.work_items(id, tenant_id, site_id) on delete restrict;
create index routes_work_item_idx on public.routes(work_item_id, tenant_id, site_id);

create or replace function public.production_summary(p_site uuid, p_from date, p_to date)
returns table (
  work_item_id       uuid,
  code               text,
  name               text,
  unit               text,
  quantity           numeric,
  unit_price         numeric,
  amount             numeric,
  planned_quantity   numeric,
  progress_percent   numeric,
  direct_cost        numeric,
  unit_cost          numeric
)
language sql stable
set search_path = ''
as $$
  with q as (
    select x.work_item_id, sum(x.quantity) as quantity
    from (
      -- elle girilen imalat
      select pe.work_item_id, pe.quantity
      from public.production_entries pe
      where pe.site_id = p_site and pe.entry_date between p_from and p_to
      union all
      -- iş kalemine bağlı güzergâhlardaki seferler
      select r.work_item_id,
             case wi2.unit::text when 'sefer' then te.trip_count::numeric when 'ton' then te.tonnage end
      from public.trip_entries te
      join public.routes r on r.id = te.route_id
      join public.work_items wi2 on wi2.id = r.work_item_id
      where te.site_id = p_site and te.entry_date between p_from and p_to
        and wi2.unit::text in ('sefer', 'ton')
    ) x
    where x.quantity is not null
    group by x.work_item_id
  ), c as (
    select e.work_item_id, sum(e.amount) as cost
    from public.expenses e
    where e.site_id = p_site and e.expense_date between p_from and p_to
      and e.work_item_id is not null
    group by e.work_item_id
  )
  select
    wi.id, wi.code, wi.name, wi.unit::text,
    coalesce(q.quantity, 0),
    wi.unit_price,
    round(coalesce(q.quantity, 0) * wi.unit_price, 2),
    wi.planned_quantity,
    case when wi.planned_quantity > 0
         then round(coalesce(q.quantity, 0) / wi.planned_quantity * 100, 2) end,
    coalesce(c.cost, 0),
    case when q.quantity > 0 and c.cost is not null
         then round(c.cost / q.quantity, 2) end
  from public.work_items wi
  left join q on q.work_item_id = wi.id
  left join c on c.work_item_id = wi.id
  where wi.site_id = p_site
  order by wi.code nulls last, wi.name;
$$;
