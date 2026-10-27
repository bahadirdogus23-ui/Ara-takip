-- Fiyat gizliliği: saha personeli işveren birim fiyatını, taşeron sefer ücretini ve araç
-- kirasını görmemeli. RLS satır bazlıdır, sütun gizleyemez; bu yüzden fiyatlar yalnızca
-- firma sahibi/yöneticiye açık ayrı tablolara taşınır.
-- DROP yok: eski sütunlar yerinde kalır ama boşaltılır (artık kullanılmaz).

create table public.work_item_prices (
  work_item_id uuid primary key,
  tenant_id    uuid not null,
  site_id      uuid not null,
  unit_price   numeric(14, 2) check (unit_price >= 0),   -- sözleşme birim fiyatı, KDV hariç
  updated_at   timestamptz not null default now(),
  foreign key (work_item_id, tenant_id, site_id) references public.work_items(id, tenant_id, site_id) on delete cascade
);

create table public.route_prices (
  route_id   uuid primary key,
  tenant_id  uuid not null,
  site_id    uuid not null,
  trip_price numeric(12, 2) check (trip_price >= 0),     -- taşerona sefer başı ücret, KDV hariç
  updated_at timestamptz not null default now(),
  foreign key (route_id, tenant_id, site_id) references public.routes(id, tenant_id, site_id) on delete cascade
);

create table public.vehicle_rates (
  vehicle_id  uuid primary key,
  tenant_id   uuid not null,
  hourly_rate numeric(12, 2) check (hourly_rate >= 0),
  daily_rate  numeric(12, 2) check (daily_rate >= 0),
  updated_at  timestamptz not null default now(),
  foreign key (vehicle_id, tenant_id) references public.vehicles(id, tenant_id) on delete cascade
);

create index work_item_prices_tenant_idx on public.work_item_prices(work_item_id, tenant_id, site_id);
create index route_prices_tenant_idx on public.route_prices(route_id, tenant_id, site_id);
create index vehicle_rates_tenant_idx on public.vehicle_rates(vehicle_id, tenant_id);

alter table public.work_item_prices enable row level security;
alter table public.route_prices enable row level security;
alter table public.vehicle_rates enable row level security;

create policy work_item_prices_manager on public.work_item_prices for all to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
create policy route_prices_manager on public.route_prices for all to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
create policy vehicle_rates_manager on public.vehicle_rates for all to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));

revoke all on public.work_item_prices, public.route_prices, public.vehicle_rates from anon;
grant select, insert, update, delete on public.work_item_prices, public.route_prices, public.vehicle_rates to authenticated;

-- Ücret değişiklikleri işlem geçmişine yazılır
create trigger audit_work_item_prices after insert or update or delete on public.work_item_prices
  for each row execute function public.write_audit_log();
create trigger audit_route_prices after insert or update or delete on public.route_prices
  for each row execute function public.write_audit_log();
create trigger audit_vehicle_rates after insert or update or delete on public.vehicle_rates
  for each row execute function public.write_audit_log();

-- write_audit_log record_id olarak "id" sütununu okur; bu tablolarda anahtar farklı adda
create or replace function public.write_audit_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log(tenant_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (
    (v_row ->> 'tenant_id')::uuid,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'work_item_id', v_row ->> 'route_id', v_row ->> 'vehicle_id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;
revoke execute on function public.write_audit_log() from authenticated, anon, public;

-- Mevcut fiyatlar yeni tablolara taşınır, eski sütunlar boşaltılır
insert into public.work_item_prices(work_item_id, tenant_id, site_id, unit_price)
  select id, tenant_id, site_id, unit_price from public.work_items where unit_price is not null;
insert into public.route_prices(route_id, tenant_id, site_id, trip_price)
  select id, tenant_id, site_id, trip_price from public.routes where trip_price is not null;
insert into public.vehicle_rates(vehicle_id, tenant_id, hourly_rate, daily_rate)
  select id, tenant_id, hourly_rate, daily_rate from public.vehicles where hourly_rate is not null or daily_rate is not null;
update public.work_items set unit_price = null where unit_price is not null;
update public.routes set trip_price = null where trip_price is not null;
update public.vehicles set hourly_rate = null, daily_rate = null where hourly_rate is not null or daily_rate is not null;

-- Dönem özeti birim fiyatı yeni tablodan alır (security invoker: saha personeli için fiyat ve tutar boş döner)
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
      select pe.work_item_id, pe.quantity
      from public.production_entries pe
      where pe.site_id = p_site and pe.entry_date between p_from and p_to
      union all
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
    wp.unit_price,
    round(coalesce(q.quantity, 0) * wp.unit_price, 2),
    wi.planned_quantity,
    case when wi.planned_quantity > 0
         then round(coalesce(q.quantity, 0) / wi.planned_quantity * 100, 2) end,
    coalesce(c.cost, 0),
    case when q.quantity > 0 and c.cost is not null
         then round(c.cost / q.quantity, 2) end
  from public.work_items wi
  left join public.work_item_prices wp on wp.work_item_id = wi.id
  left join q on q.work_item_id = wi.id
  left join c on c.work_item_id = wi.id
  where wi.site_id = p_site
  order by wi.code nulls last, wi.name;
$$;
