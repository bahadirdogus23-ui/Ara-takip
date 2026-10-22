-- Politikalar private.* yardımcılarına geçirilir. DROP yerine ALTER POLICY
-- kullanıldı: kurallar aynı, yalnızca çağrılan fonksiyon değişir.

alter policy tenants_select on public.tenants using (private.is_member(id));
alter policy tenants_update on public.tenants
  using (private.has_role(id, '{owner}')) with check (private.has_role(id, '{owner}'));

alter policy memberships_select on public.memberships
  using (user_id = (select auth.uid()) or private.has_role(tenant_id, '{owner}'));
alter policy memberships_write on public.memberships
  using (private.has_role(tenant_id, '{owner}')) with check (private.has_role(tenant_id, '{owner}'));

alter policy sites_select on public.sites using (private.is_member(tenant_id));
alter policy sites_write on public.sites
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
alter policy work_items_select on public.work_items using (private.is_member(tenant_id));
alter policy work_items_write on public.work_items
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
alter policy vehicles_select on public.vehicles using (private.is_member(tenant_id));
alter policy vehicles_write on public.vehicles
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
alter policy routes_select on public.routes using (private.is_member(tenant_id));
alter policy routes_write on public.routes
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));

alter policy production_select on public.production_entries using (private.is_member(tenant_id));
alter policy production_insert on public.production_entries with check (private.is_member(tenant_id));
alter policy production_update on public.production_entries
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)))
  with check (private.is_member(tenant_id));
alter policy production_delete on public.production_entries
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)));

alter policy trips_select on public.trip_entries using (private.is_member(tenant_id));
alter policy trips_insert on public.trip_entries with check (private.is_member(tenant_id));
alter policy trips_update on public.trip_entries
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)))
  with check (private.is_member(tenant_id));
alter policy trips_delete on public.trip_entries
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)));

alter policy expenses_all on public.expenses
  using (private.has_role(tenant_id, '{owner,manager}')) with check (private.has_role(tenant_id, '{owner,manager}'));
alter policy audit_log_select on public.audit_log using (private.has_role(tenant_id, '{owner,manager}'));

-- Eski yardımcılar artık hiçbir politikada kullanılmıyor: API'den çağrılamasın.
-- (Fonksiyonları silmek ayrı bir onaylı migration ile yapılacak.)
revoke execute on function public.is_member(uuid) from authenticated, anon, public;
revoke execute on function public.has_role(uuid, public.member_role[]) from authenticated, anon, public;
