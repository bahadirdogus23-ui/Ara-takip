-- Supabase güvenlik danışmanı uyarısı: yetki yardımcıları (is_member, has_role)
-- public şemasında olduğu için /rest/v1/rpc üzerinden çağrılabiliyordu.
-- Yenileri API'ye açık olmayan "private" şemasında. Ayrıca auth.uid() satır başına
-- değil sorgu başına bir kez hesaplanır: (select auth.uid()).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_member(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid())
  );
$$;

create function private.has_role(p_tenant uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_role(uuid, public.member_role[]) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.member_role[]) to authenticated;
