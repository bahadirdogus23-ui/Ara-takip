-- Firma kullanıcıları: firma sahibi, Hafriyol'a kayıtlı birini e-postasıyla ekler,
-- rolünü değiştirir veya çıkarır.
--
-- auth.users tablosu istemciye kapalı olduğu için e-posta ile arama ve üye listesi
-- security definer fonksiyonlarla yapılır; her fonksiyon önce çağıranın o firmanın
-- sahibi olduğunu kontrol eder.

create function public.add_member(p_tenant uuid, p_email text, p_role public.member_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not private.has_role(p_tenant, '{owner}') then
    raise exception 'Kullanıcı eklemek için firma sahibi olmalısınız' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Bu e-posta ile kayıtlı kullanıcı yok. Önce Hafriyol''a kayıt olmasını isteyin.' using errcode = 'P0001';
  end if;
  insert into public.memberships(tenant_id, user_id, role)
    values (p_tenant, v_user, p_role)
    on conflict (tenant_id, user_id) do update set role = excluded.role;
end;
$$;

create function public.tenant_members(p_tenant uuid)
returns table (user_id uuid, email text, role public.member_role, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant and private.has_role(p_tenant, '{owner}')
  order by m.created_at;
$$;

revoke execute on function public.add_member(uuid, text, public.member_role) from public, anon;
revoke execute on function public.tenant_members(uuid) from public, anon;
grant execute on function public.add_member(uuid, text, public.member_role) to authenticated;
grant execute on function public.tenant_members(uuid) to authenticated;

-- Firma sahipsiz kalamaz: son sahip çıkarılamaz veya rolü düşürülemez.
create function private.keep_one_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.tenants t where t.id = old.tenant_id)  -- firma silinirken engelleme
     and not exists (
       select 1 from public.memberships m
       where m.tenant_id = old.tenant_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'Firmanın en az bir sahibi olmalı' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_one_owner before update or delete on public.memberships
  for each row execute function private.keep_one_owner();
