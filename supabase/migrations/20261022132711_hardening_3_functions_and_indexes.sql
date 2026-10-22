-- Tetikleyici fonksiyonları doğrudan çağrılamaz, search_path sabitlenir,
-- yabancı anahtarlara indeks eklenir.
-- public.create_tenant bilinçli olarak RPC'ye açıktır: kullanıcı ilk firmasını böyle açar.

revoke execute on function public.write_audit_log() from authenticated, anon, public;
revoke execute on function public.force_created_by() from authenticated, anon, public;

alter function public.force_created_by() set search_path = '';
alter function public.production_summary(uuid, date, date) set search_path = '';
alter function public.expense_summary(uuid, date, date) set search_path = '';

create index work_items_site_tenant_idx         on public.work_items(site_id, tenant_id);
create index routes_site_tenant_idx             on public.routes(site_id, tenant_id);
create index production_entries_site_tenant_idx on public.production_entries(site_id, tenant_id);
create index production_entries_item_idx        on public.production_entries(work_item_id, tenant_id, site_id);
create index production_entries_created_by_idx  on public.production_entries(created_by);
create index trip_entries_site_tenant_idx       on public.trip_entries(site_id, tenant_id);
create index trip_entries_vehicle_idx           on public.trip_entries(vehicle_id, tenant_id);
create index trip_entries_route_idx             on public.trip_entries(route_id, tenant_id, site_id);
create index trip_entries_created_by_idx        on public.trip_entries(created_by);
create index expenses_site_tenant_idx           on public.expenses(site_id, tenant_id);
create index expenses_item_idx                  on public.expenses(work_item_id, tenant_id, site_id);
create index expenses_created_by_idx            on public.expenses(created_by);
