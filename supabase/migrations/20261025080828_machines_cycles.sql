-- 2. aşama: iş makinesi saat/mazot kayıtları ve şişirilmiş sefer denetimi için alanlar.
-- Yalnızca ekleme yapılır (yeni tablo ve yeni sütunlar); mevcut veriye dokunulmaz.

-- Araç başına beklenen yakıt tüketimi (litre/saat). Girilmişse aşan kayıtlar işaretlenir.
alter table public.vehicles
  add column fuel_norm_lph numeric(6, 2) check (fuel_norm_lph > 0);

-- Güzergâhta bir seferin gidiş-dönüş süresi (dakika, yükleme-boşaltma dahil).
-- Bir kamyonun bir günde en fazla kaç sefer yapabileceği buradan hesaplanır.
alter table public.routes
  add column cycle_minutes integer check (cycle_minutes between 1 and 1440);

create table public.machine_logs (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  site_id            uuid not null,
  vehicle_id         uuid not null,
  log_date           date not null,
  hours              numeric(5, 2) check (hours > 0 and hours <= 24),          -- çalışma saati
  fuel_liters        numeric(8, 2) check (fuel_liters > 0 and fuel_liters <= 5000), -- alınan mazot
  operator           text check (length(operator) <= 100),
  note               text check (length(note) <= 500),
  client_request_id  uuid,
  created_by         uuid not null default auth.uid() references auth.users(id),
  created_at         timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  foreign key (vehicle_id, tenant_id) references public.vehicles(id, tenant_id) on delete restrict,
  unique (tenant_id, client_request_id),
  check (hours is not null or fuel_liters is not null)
);

create index machine_logs_site_date_idx  on public.machine_logs(site_id, log_date);
create index machine_logs_site_tenant_idx on public.machine_logs(site_id, tenant_id);
create index machine_logs_vehicle_idx    on public.machine_logs(vehicle_id, tenant_id);
create index machine_logs_created_by_idx on public.machine_logs(created_by);

create trigger machine_logs_created_by before insert on public.machine_logs
  for each row execute function public.force_created_by();
create trigger audit_machine_logs after insert or update or delete on public.machine_logs
  for each row execute function public.write_audit_log();

alter table public.machine_logs enable row level security;

-- Saha kayıtlarıyla aynı kural: üyeler okur ve ekler; saha personeli yalnızca kendi
-- kaydını düzeltir/siler, firma sahibi/yönetici hepsini.
create policy machine_logs_select on public.machine_logs for select to authenticated
  using (private.is_member(tenant_id));
create policy machine_logs_insert on public.machine_logs for insert to authenticated
  with check (private.is_member(tenant_id));
create policy machine_logs_update on public.machine_logs for update to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)))
  with check (private.is_member(tenant_id));
create policy machine_logs_delete on public.machine_logs for delete to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)));

revoke all on public.machine_logs from anon;
grant select, insert, update, delete on public.machine_logs to authenticated;
