-- F1-2: araç türü ve araç–şantiye ataması (H15, H20).
-- Yalnızca ekleme; mevcut veri silinmez.

-- Kamyon/iş makinesi ayrımı artık serbest metinden tahmin edilmez, araçta saklanır.
alter table public.vehicles
  add column kind text not null default 'kamyon'
  check (kind in ('kamyon', 'is_makinesi', 'diger'));

-- Mevcut araçlar türlerine göre bir kez sınıflandırılır; kullanıcı sonra değiştirebilir
update public.vehicles
set kind = case
  when vehicle_type ~* '(ekskavat|kepçe|kepce|beko|greyder|dozer|silindir|loder|loader|vinç|vinc|finişer|finiser|kırıcı|kirici|forklift|jeneratör|jenerator|jcb|kazıcı|kazici|paletli|iş makine|is makine)' then 'is_makinesi'
  when vehicle_type ~* '(arazöz|arazoz|sulama|pikap|binek|minibüs|minibus|servis)' then 'diger'
  else 'kamyon'
end;

-- Araç hangi şantiyede çalışıyor. Bir şantiyeye hiç araç atanmamışsa sayaç tüm araçları gösterir.
create table public.site_vehicles (
  tenant_id  uuid not null,
  site_id    uuid not null,
  vehicle_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (site_id, vehicle_id),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  foreign key (vehicle_id, tenant_id) references public.vehicles(id, tenant_id) on delete cascade
);

create index site_vehicles_vehicle_idx on public.site_vehicles(vehicle_id, tenant_id);
create index site_vehicles_site_tenant_idx on public.site_vehicles(site_id, tenant_id);

alter table public.site_vehicles enable row level security;

create policy site_vehicles_select on public.site_vehicles for select to authenticated
  using (private.is_member(tenant_id));
create policy site_vehicles_manager_insert on public.site_vehicles for insert to authenticated
  with check (private.has_role(tenant_id, '{owner,manager}'));
create policy site_vehicles_manager_delete on public.site_vehicles for delete to authenticated
  using (private.has_role(tenant_id, '{owner,manager}'));

revoke all on public.site_vehicles from anon;
grant select, insert, delete on public.site_vehicles to authenticated;
