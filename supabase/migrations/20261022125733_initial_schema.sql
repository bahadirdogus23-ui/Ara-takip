-- Hafriyol — ilk veritabanı şeması (TASLAK)
-- Hedef: Supabase PostgreSQL. auth.users ve auth.uid() Supabase tarafından sağlanır.
--
-- Temel güvenlik ilkesi: her iş tablosunda tenant_id (firma) vardır ve
-- satır düzeyinde güvenlik (RLS) ile kullanıcı yalnızca üyesi olduğu
-- firmanın kayıtlarını görebilir. Ayrıca bileşik yabancı anahtarlar sayesinde
-- bir kayıt başka firmanın şantiyesine / iş kalemine bağlanamaz.

-- ---------------------------------------------------------------------------
-- 1. Firmalar ve üyelikler
-- ---------------------------------------------------------------------------

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 200),
  tax_number  text,
  created_at  timestamptz not null default now()
);

-- owner   : firma sahibi, her şeyi yapar, kullanıcı ekler/çıkarır
-- manager : şantiye şefi / ofis, tüm kayıtları yönetir
-- field   : saha personeli, imalat ve sefer girer; giderleri göremez
create type public.member_role as enum ('owner', 'manager', 'field');

create table public.memberships (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.member_role not null default 'field',
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index memberships_user_idx on public.memberships(user_id);

-- ---------------------------------------------------------------------------
-- 2. Yetki yardımcı fonksiyonları
-- security definer: RLS politikası içinde memberships tablosunu okurken
-- sonsuz döngüye (politikanın kendini çağırması) girmemek için gereklidir.
-- ---------------------------------------------------------------------------

create function public.is_member(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = auth.uid()
  );
$$;

create function public.has_role(p_tenant uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

-- Yeni firma açma: firmayı oluşturur ve çağıran kullanıcıyı owner yapar.
-- (RLS, kullanıcının kendini bir firmaya doğrudan eklemesine izin vermez.)
create function public.create_tenant(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Oturum açmanız gerekiyor';
  end if;
  insert into public.tenants(name) values (p_name) returning id into v_id;
  insert into public.memberships(tenant_id, user_id, role)
    values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Şantiyeler ve tanımlar
-- ---------------------------------------------------------------------------

create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null check (length(trim(name)) between 2 and 200),
  code        text,
  employer    text,               -- işveren (ör. belediye, karayolları)
  location    text,
  start_date  date,
  end_date    date,
  status      text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index sites_tenant_idx on public.sites(tenant_id);

-- İzin verilen birimler. Birim dönüşümü ilk sürümde YAPILMAZ:
-- her iş kaleminin tek bir birimi vardır ve miktarlar o birimde girilir.
create domain public.unit_code as text
  check (value in ('m', 'm2', 'm3', 'ton', 'kg', 'adet', 'lt', 'km', 'saat', 'gun', 'sefer'));

-- İş kalemleri şantiyeye özeldir: her sözleşmenin kendi pozları ve birim fiyatı vardır.
create table public.work_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  site_id          uuid not null,
  code             text,                      -- poz no
  name             text not null check (length(trim(name)) between 2 and 300),
  unit             public.unit_code not null,
  unit_price       numeric(14, 2) check (unit_price >= 0),   -- sözleşme birim fiyatı, KDV hariç, TL
  planned_quantity numeric(16, 3) check (planned_quantity >= 0),
  created_at       timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  unique (id, tenant_id, site_id)
);

create index work_items_site_idx on public.work_items(site_id);

create table public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  plate         text not null,
  vehicle_type  text not null,                -- kamyon, ekskavatör, greyder ...
  ownership     text not null default 'own' check (ownership in ('own', 'rented', 'subcontractor')),
  capacity_ton  numeric(8, 2) check (capacity_ton > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, plate)
);

create table public.routes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  site_id      uuid not null,
  name         text not null,
  origin       text,
  destination  text,
  distance_km  numeric(8, 2) check (distance_km >= 0),
  created_at   timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  unique (id, tenant_id, site_id)
);

-- ---------------------------------------------------------------------------
-- 4. Günlük saha kayıtları
-- client_request_id: formun iki kez gönderilmesi (çift tıklama, zayıf internet)
-- durumunda aynı kaydın iki kez yazılmasını engeller.
-- ---------------------------------------------------------------------------

create table public.production_entries (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  site_id            uuid not null,
  work_item_id       uuid not null,
  entry_date         date not null,
  quantity           numeric(16, 3) not null check (quantity > 0),
  note               text,
  client_request_id  uuid,
  created_by         uuid not null default auth.uid() references auth.users(id),
  created_at         timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  foreign key (work_item_id, tenant_id, site_id)
    references public.work_items(id, tenant_id, site_id) on delete restrict,
  unique (tenant_id, client_request_id)
);

create index production_entries_site_date_idx on public.production_entries(site_id, entry_date);

create table public.trip_entries (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  site_id            uuid not null,
  vehicle_id         uuid not null,
  route_id           uuid,
  entry_date         date not null,
  trip_count         integer not null check (trip_count > 0 and trip_count <= 500),
  tonnage            numeric(12, 3) check (tonnage >= 0),     -- toplam ton, isteğe bağlı
  note               text,
  client_request_id  uuid,
  created_by         uuid not null default auth.uid() references auth.users(id),
  created_at         timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  foreign key (vehicle_id, tenant_id) references public.vehicles(id, tenant_id) on delete restrict,
  foreign key (route_id, tenant_id, site_id)
    references public.routes(id, tenant_id, site_id) on delete restrict,
  unique (tenant_id, client_request_id)
);

create index trip_entries_site_date_idx on public.trip_entries(site_id, entry_date);

create type public.expense_category as enum
  ('fuel', 'labor', 'material', 'subcontractor', 'equipment_rent', 'maintenance', 'other');

create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  site_id            uuid not null,
  work_item_id       uuid,          -- doluysa bu gider doğrudan o iş kalemine aittir
  expense_date       date not null,
  category           public.expense_category not null,
  amount             numeric(14, 2) not null check (amount > 0),    -- KDV hariç, TL
  vat_rate           numeric(5, 2) not null default 20 check (vat_rate between 0 and 100),
  supplier           text,
  description        text,
  client_request_id  uuid,
  created_by         uuid not null default auth.uid() references auth.users(id),
  created_at         timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  foreign key (work_item_id, tenant_id, site_id)
    references public.work_items(id, tenant_id, site_id) on delete restrict,
  unique (tenant_id, client_request_id)
);

create index expenses_site_date_idx on public.expenses(site_id, expense_date);

-- created_by istemciden gelse bile oturumdaki kullanıcıya zorlanır.
-- (Oturum yoksa — ör. yönetici veri aktarımı — gönderilen değer korunur.)
create function public.force_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

create trigger production_entries_created_by before insert on public.production_entries
  for each row execute function public.force_created_by();
create trigger trip_entries_created_by before insert on public.trip_entries
  for each row execute function public.force_created_by();
create trigger expenses_created_by before insert on public.expenses
  for each row execute function public.force_created_by();

-- ---------------------------------------------------------------------------
-- 5. İşlem geçmişi (audit log)
-- Kullanıcılar bu tabloya doğrudan yazamaz; yalnızca tetikleyici yazar.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create index audit_log_tenant_idx on public.audit_log(tenant_id, changed_at desc);

create function public.write_audit_log()
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
    (v_row ->> 'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

create trigger audit_sites after insert or update or delete on public.sites
  for each row execute function public.write_audit_log();
create trigger audit_work_items after insert or update or delete on public.work_items
  for each row execute function public.write_audit_log();
create trigger audit_production_entries after insert or update or delete on public.production_entries
  for each row execute function public.write_audit_log();
create trigger audit_trip_entries after insert or update or delete on public.trip_entries
  for each row execute function public.write_audit_log();
create trigger audit_expenses after insert or update or delete on public.expenses
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 6. Satır düzeyinde güvenlik (RLS)
-- ---------------------------------------------------------------------------

alter table public.tenants            enable row level security;
alter table public.memberships        enable row level security;
alter table public.sites              enable row level security;
alter table public.work_items         enable row level security;
alter table public.vehicles           enable row level security;
alter table public.routes             enable row level security;
alter table public.production_entries enable row level security;
alter table public.trip_entries       enable row level security;
alter table public.expenses           enable row level security;
alter table public.audit_log          enable row level security;

-- Firmalar: üyeler görür, yalnızca owner günceller. Oluşturma create_tenant ile.
create policy tenants_select on public.tenants for select to authenticated
  using (public.is_member(id));
create policy tenants_update on public.tenants for update to authenticated
  using (public.has_role(id, array['owner']::public.member_role[]));

-- Üyelikler: kişi kendi üyeliğini görür; owner firmanın tüm üyeliklerini yönetir.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(tenant_id, array['owner']::public.member_role[]));
create policy memberships_write on public.memberships for all to authenticated
  using (public.has_role(tenant_id, array['owner']::public.member_role[]))
  with check (public.has_role(tenant_id, array['owner']::public.member_role[]));

-- Tanım tabloları: tüm üyeler okur, owner/manager yazar.
create policy sites_select on public.sites for select to authenticated
  using (public.is_member(tenant_id));
create policy sites_write on public.sites for all to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]));

create policy work_items_select on public.work_items for select to authenticated
  using (public.is_member(tenant_id));
create policy work_items_write on public.work_items for all to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]));

create policy vehicles_select on public.vehicles for select to authenticated
  using (public.is_member(tenant_id));
create policy vehicles_write on public.vehicles for all to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]));

create policy routes_select on public.routes for select to authenticated
  using (public.is_member(tenant_id));
create policy routes_write on public.routes for all to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]));

-- Saha kayıtları (imalat, sefer): tüm üyeler okur ve ekler;
-- saha personeli yalnızca kendi kaydını düzeltir/siler, owner/manager hepsini.
create policy production_select on public.production_entries for select to authenticated
  using (public.is_member(tenant_id));
create policy production_insert on public.production_entries for insert to authenticated
  with check (public.is_member(tenant_id));
create policy production_update on public.production_entries for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[])
         or (created_by = auth.uid() and public.is_member(tenant_id)))
  with check (public.is_member(tenant_id));
create policy production_delete on public.production_entries for delete to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[])
         or (created_by = auth.uid() and public.is_member(tenant_id)));

create policy trips_select on public.trip_entries for select to authenticated
  using (public.is_member(tenant_id));
create policy trips_insert on public.trip_entries for insert to authenticated
  with check (public.is_member(tenant_id));
create policy trips_update on public.trip_entries for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[])
         or (created_by = auth.uid() and public.is_member(tenant_id)))
  with check (public.is_member(tenant_id));
create policy trips_delete on public.trip_entries for delete to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[])
         or (created_by = auth.uid() and public.is_member(tenant_id)));

-- Giderler: yalnızca owner/manager görür ve yönetir.
create policy expenses_all on public.expenses for all to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]));

-- İşlem geçmişi: yalnızca owner/manager okur; kimse doğrudan yazamaz.
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_role(tenant_id, array['owner', 'manager']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- 7. Dönem özetleri
-- security invoker (varsayılan): çağıranın RLS kuralları geçerlidir.
-- Formüller:
--   tutar (TL)      = round(miktar × birim_fiyat, 2)
--   gerçekleşme (%) = round(miktar / planlanan_miktar × 100, 2)
--   birim maliyet   = round(iş kalemine bağlı gider / miktar, 2)
-- ---------------------------------------------------------------------------

create function public.production_summary(p_site uuid, p_from date, p_to date)
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
as $$
  with q as (
    select pe.work_item_id, sum(pe.quantity) as quantity
    from public.production_entries pe
    where pe.site_id = p_site and pe.entry_date between p_from and p_to
    group by pe.work_item_id
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

create function public.expense_summary(p_site uuid, p_from date, p_to date)
returns table (
  category     text,
  amount       numeric,
  vat_amount   numeric,
  total        numeric,
  entry_count  bigint
)
language sql stable
as $$
  select
    e.category::text,
    sum(e.amount),
    sum(round(e.amount * e.vat_rate / 100, 2)),
    sum(e.amount + round(e.amount * e.vat_rate / 100, 2)),
    count(*)
  from public.expenses e
  where e.site_id = p_site and e.expense_date between p_from and p_to
  group by e.category
  order by e.category;
$$;

-- ---------------------------------------------------------------------------
-- 8. Yetkiler: anonim kullanıcı hiçbir şeye erişemez.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
