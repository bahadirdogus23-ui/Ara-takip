-- F1-4: ücret geçmişi ve dönem kilidi (H04, H19).
-- 1) Ücret değişince geçmiş dönemin tutarı değişmesin: her ücret bir geçerlilik başlangıcıyla
--    saklanır; hesaplar kaydın tarihindeki ücreti kullanır. Eski "güncel ücret" tabloları
--    (work_item_prices, route_prices, vehicle_rates) en son ücreti gösteren kopya olarak kalır
--    ve geçmiş tablosundan tetikleyiciyle güncellenir.
-- 2) Dönem kilidi: şantiyede kilitlenen tarihe kadar kayıt eklenemez, düzeltilemez, silinemez.
-- 3) Saha personeli 7 günden eski kayıt ekleyemez, değiştiremez, silemez (kural artık veritabanında).
-- DROP yok; mevcut veri silinmez.

-- ---------------------------------------------------------------------------
-- Dönem kilidi
-- ---------------------------------------------------------------------------
alter table public.sites add column locked_until date;

-- Türkiye'de bugünün tarihi. Veritabanı testleri "bugün"ü hafriyol.today oturum ayarıyla
-- sabitler (API istemcileri oturum ayarı değiştiremez).
create or replace function private.today_tr()
returns date
language sql stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('hafriyol.today', true), '')::date,
    (now() at time zone 'Europe/Istanbul')::date
  )
$$;

-- Kayıt tabloları: tg_argv[0] tarih sütunu, tg_argv[1] = 'field_window' ise saha personeline 7 gün sınırı
create or replace function private.guard_locked_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_rows jsonb[] := array_remove(array[
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    case when tg_op <> 'INSERT' then to_jsonb(old) end
  ], null);
  v_row jsonb;
  v_date date;
  v_lock date;
begin
  foreach v_row in array v_rows loop
    v_date := (v_row ->> tg_argv[0])::date;
    select s.locked_until into v_lock
    from public.sites s
    where s.id = (v_row ->> 'site_id')::uuid;
    if v_lock is not null and v_date <= v_lock then
      raise exception 'Bu tarih kilitli dönemde (% tarihine kadar kilitli). Değişiklik için firma sahibinin kilidi açması gerekir.',
        to_char(v_lock, 'DD.MM.YYYY') using errcode = 'P0001';
    end if;
    if tg_argv[1] = 'field_window'
       and auth.uid() is not null
       and not private.has_role((v_row ->> 'tenant_id')::uuid, '{owner,manager}')
       and v_date < private.today_tr() - 7 then
      raise exception 'Saha personeli 7 günden eski kayıt ekleyemez, değiştiremez ve silemez. Yöneticinize iletin.'
        using errcode = 'P0001';
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

create trigger trip_entries_guard_period before insert or update or delete on public.trip_entries
  for each row execute function private.guard_locked_period('entry_date', 'field_window');
create trigger production_entries_guard_period before insert or update or delete on public.production_entries
  for each row execute function private.guard_locked_period('entry_date', 'field_window');
create trigger machine_logs_guard_period before insert or update or delete on public.machine_logs
  for each row execute function private.guard_locked_period('log_date', 'field_window');
create trigger expenses_guard_period before insert or update or delete on public.expenses
  for each row execute function private.guard_locked_period('expense_date', 'none');

-- Kilit ileri alınabilir (sahip/yönetici); geri alma ya da kaldırma yalnızca firma sahibinin
create or replace function private.guard_site_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.locked_until is not distinct from old.locked_until then
    return new;
  end if;
  if new.locked_until > private.today_tr() then
    raise exception 'Gelecekteki bir tarih kilitlenemez.' using errcode = 'P0001';
  end if;
  if old.locked_until is not null
     and (new.locked_until is null or new.locked_until < old.locked_until)
     and auth.uid() is not null
     and not private.has_role(new.tenant_id, '{owner}') then
    raise exception 'Kilitli dönemi yalnızca firma sahibi açabilir.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger sites_guard_lock before update of locked_until on public.sites
  for each row execute function private.guard_site_lock();

-- ---------------------------------------------------------------------------
-- Ücret geçmişi
-- ---------------------------------------------------------------------------
create table public.work_item_price_history (
  work_item_id uuid not null,
  tenant_id    uuid not null,
  site_id      uuid not null,
  valid_from   date not null,
  unit_price   numeric(14, 2) check (unit_price >= 0),   -- null: bu tarihten itibaren fiyat yok
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  primary key (work_item_id, valid_from),
  foreign key (work_item_id, tenant_id, site_id) references public.work_items(id, tenant_id, site_id) on delete cascade
);

create table public.route_price_history (
  route_id   uuid not null,
  tenant_id  uuid not null,
  site_id    uuid not null,
  valid_from date not null,
  trip_price numeric(12, 2) check (trip_price >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key (route_id, valid_from),
  foreign key (route_id, tenant_id, site_id) references public.routes(id, tenant_id, site_id) on delete cascade
);

create table public.vehicle_rate_history (
  vehicle_id  uuid not null,
  tenant_id   uuid not null,
  valid_from  date not null,
  hourly_rate numeric(12, 2) check (hourly_rate >= 0),
  daily_rate  numeric(12, 2) check (daily_rate >= 0),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  primary key (vehicle_id, valid_from),
  foreign key (vehicle_id, tenant_id) references public.vehicles(id, tenant_id) on delete cascade
);

create index work_item_price_history_fk_idx on public.work_item_price_history(work_item_id, tenant_id, site_id);
create index route_price_history_fk_idx on public.route_price_history(route_id, tenant_id, site_id);
create index vehicle_rate_history_fk_idx on public.vehicle_rate_history(vehicle_id, tenant_id);

alter table public.work_item_price_history enable row level security;
alter table public.route_price_history enable row level security;
alter table public.vehicle_rate_history enable row level security;

create policy work_item_price_history_manager on public.work_item_price_history for all to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
create policy route_price_history_manager on public.route_price_history for all to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
create policy vehicle_rate_history_manager on public.vehicle_rate_history for all to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));

revoke all on public.work_item_price_history, public.route_price_history, public.vehicle_rate_history from anon;
grant select, insert, update, delete
  on public.work_item_price_history, public.route_price_history, public.vehicle_rate_history to authenticated;

create trigger audit_work_item_price_history after insert or update or delete on public.work_item_price_history
  for each row execute function public.write_audit_log();
create trigger audit_route_price_history after insert or update or delete on public.route_price_history
  for each row execute function public.write_audit_log();
create trigger audit_vehicle_rate_history after insert or update or delete on public.vehicle_rate_history
  for each row execute function public.write_audit_log();

-- Mevcut ücretler en baştan geçerli sayılır
insert into public.work_item_price_history(work_item_id, tenant_id, site_id, valid_from, unit_price, created_by)
  select work_item_id, tenant_id, site_id, date '2000-01-01', unit_price, null
  from public.work_item_prices where unit_price is not null;
insert into public.route_price_history(route_id, tenant_id, site_id, valid_from, trip_price, created_by)
  select route_id, tenant_id, site_id, date '2000-01-01', trip_price, null
  from public.route_prices where trip_price is not null;
insert into public.vehicle_rate_history(vehicle_id, tenant_id, valid_from, hourly_rate, daily_rate, created_by)
  select vehicle_id, tenant_id, date '2000-01-01', hourly_rate, daily_rate, null
  from public.vehicle_rates where hourly_rate is not null or daily_rate is not null;

-- Ücret değişikliği kilitli dönemi etkileyemez; ileri tarihli ücret girilmez.
-- tg_argv[0] = 'site': şantiyenin kilidi; 'tenant': araç kirası firma geneli, herhangi bir şantiyenin kilidi
create or replace function private.guard_price_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_rows jsonb[] := array_remove(array[
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    case when tg_op <> 'INSERT' then to_jsonb(old) end
  ], null);
  v_row jsonb;
  v_from date;
  v_lock date;
begin
  if tg_op <> 'DELETE' and new.valid_from > private.today_tr() then
    raise exception 'Ücretin geçerlilik başlangıcı ileri bir tarih olamaz.' using errcode = 'P0001';
  end if;
  foreach v_row in array v_rows loop
    v_from := (v_row ->> 'valid_from')::date;
    select max(s.locked_until) into v_lock
    from public.sites s
    where case when tg_argv[0] = 'site'
               then s.id = (v_row ->> 'site_id')::uuid
               else s.tenant_id = (v_row ->> 'tenant_id')::uuid end;
    if v_lock is not null and v_from <= v_lock then
      raise exception 'Bu ücret değişikliği kilitli dönemi (% tarihine kadar) etkiler. Geçerlilik başlangıcını kilitten sonraki bir gün seçin.',
        to_char(v_lock, 'DD.MM.YYYY') using errcode = 'P0001';
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

create trigger work_item_price_history_guard before insert or update or delete on public.work_item_price_history
  for each row execute function private.guard_price_history('site');
create trigger route_price_history_guard before insert or update or delete on public.route_price_history
  for each row execute function private.guard_price_history('site');
create trigger vehicle_rate_history_guard before insert or update or delete on public.vehicle_rate_history
  for each row execute function private.guard_price_history('tenant');

-- Güncel ücret tabloları geçmişin en son satırından güncellenir
create or replace function private.sync_work_item_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.work_item_id, old.work_item_id);
  v public.work_item_price_history;
begin
  select * into v from public.work_item_price_history h
  where h.work_item_id = v_id order by h.valid_from desc limit 1;
  if v.work_item_id is null or v.unit_price is null then
    delete from public.work_item_prices where work_item_id = v_id;
  else
    insert into public.work_item_prices(work_item_id, tenant_id, site_id, unit_price, updated_at)
    values (v.work_item_id, v.tenant_id, v.site_id, v.unit_price, now())
    on conflict (work_item_id) do update set unit_price = excluded.unit_price, updated_at = now();
  end if;
  return null;
end;
$$;

create or replace function private.sync_route_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.route_id, old.route_id);
  v public.route_price_history;
begin
  select * into v from public.route_price_history h
  where h.route_id = v_id order by h.valid_from desc limit 1;
  if v.route_id is null or v.trip_price is null then
    delete from public.route_prices where route_id = v_id;
  else
    insert into public.route_prices(route_id, tenant_id, site_id, trip_price, updated_at)
    values (v.route_id, v.tenant_id, v.site_id, v.trip_price, now())
    on conflict (route_id) do update set trip_price = excluded.trip_price, updated_at = now();
  end if;
  return null;
end;
$$;

create or replace function private.sync_vehicle_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.vehicle_id, old.vehicle_id);
  v public.vehicle_rate_history;
begin
  select * into v from public.vehicle_rate_history h
  where h.vehicle_id = v_id order by h.valid_from desc limit 1;
  if v.vehicle_id is null or (v.hourly_rate is null and v.daily_rate is null) then
    delete from public.vehicle_rates where vehicle_id = v_id;
  else
    insert into public.vehicle_rates(vehicle_id, tenant_id, hourly_rate, daily_rate, updated_at)
    values (v.vehicle_id, v.tenant_id, v.hourly_rate, v.daily_rate, now())
    on conflict (vehicle_id) do update
      set hourly_rate = excluded.hourly_rate, daily_rate = excluded.daily_rate, updated_at = now();
  end if;
  return null;
end;
$$;

create trigger work_item_price_history_sync after insert or update or delete on public.work_item_price_history
  for each row execute function private.sync_work_item_price();
create trigger route_price_history_sync after insert or update or delete on public.route_price_history
  for each row execute function private.sync_route_price();
create trigger vehicle_rate_history_sync after insert or update or delete on public.vehicle_rate_history
  for each row execute function private.sync_vehicle_rate();

revoke all on function private.today_tr() from public;
grant execute on function private.today_tr() to authenticated;
revoke all on function private.guard_locked_period() from public;
revoke all on function private.guard_site_lock() from public;
revoke all on function private.guard_price_history() from public;
revoke all on function private.sync_work_item_price() from public;
revoke all on function private.sync_route_price() from public;
revoke all on function private.sync_vehicle_rate() from public;

-- ---------------------------------------------------------------------------
-- Dönem özeti: her kayıt kendi tarihindeki birim fiyatla hesaplanır.
-- unit_price: dönemde tek fiyat varsa o, birden çoksa ortalama (tutar ÷ miktar).
-- security invoker: saha personeli fiyat geçmişini göremez, fiyat ve tutar boş döner.
-- ---------------------------------------------------------------------------
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
  with x as (
    select pe.work_item_id, pe.entry_date, pe.quantity
    from public.production_entries pe
    where pe.site_id = p_site and pe.entry_date between p_from and p_to
    union all
    select r.work_item_id, te.entry_date,
           case wi2.unit::text when 'sefer' then te.trip_count::numeric when 'ton' then te.tonnage end
    from public.trip_entries te
    join public.routes r on r.id = te.route_id
    join public.work_items wi2 on wi2.id = r.work_item_id
    where te.site_id = p_site and te.entry_date between p_from and p_to
      and wi2.unit::text in ('sefer', 'ton')
  ), q as (
    select x.work_item_id,
           sum(x.quantity) as quantity,
           sum(x.quantity * p.unit_price) as amount,
           min(p.unit_price) as min_price,
           max(p.unit_price) as max_price
    from x
    left join lateral (
      select h.unit_price
      from public.work_item_price_history h
      where h.work_item_id = x.work_item_id and h.valid_from <= x.entry_date
      order by h.valid_from desc
      limit 1
    ) p on true
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
    case
      when q.min_price is null then wp.unit_price
      when q.min_price = q.max_price then q.min_price
      when q.quantity > 0 then round(q.amount / q.quantity, 2)
    end,
    case
      when q.amount is not null then round(q.amount, 2)
      when wp.unit_price is not null then 0
    end,
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
