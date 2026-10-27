-- 1) Firma aboneliği: yeni firma "ödeme bekliyor" açılır; platform yöneticisi ödemeyi görünce
--    aktif eder. Aktif olmayan firmada uygulama ödeme ekranına yönlendirir.
-- 2) Davet kodu: patron (her rol) ve yönetici/mühendis (yalnızca saha personeli) kod üretir;
--    kayıt olan kişi kodu girerek firmaya o rolle katılır.
-- Yalnızca ekleme; mevcut firmalar aktif sayılır. DROP yok.

alter table public.tenants
  add column plan_status text not null default 'pending' check (plan_status in ('pending', 'active', 'suspended')),
  add column paid_until date,
  add column payment_note text check (length(payment_note) <= 300),
  add column payment_notified_at timestamptz,
  add column activated_at timestamptz;

-- Bu migration'dan önce açılmış firmalar çalışmaya devam eder
update public.tenants set plan_status = 'active', activated_at = now() where plan_status = 'pending';

-- Abonelik alanlarını yalnızca platform yöneticisi değiştirir (firma sahibi tenants_update ile adı değiştirebilir)
create function private.guard_tenant_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.plan_status, new.paid_until, new.activated_at) is distinct from (old.plan_status, old.paid_until, old.activated_at)
     and current_setting('hafriyol.plan_admin', true) is distinct from 'on' then
    raise exception 'Abonelik durumu yalnızca Hafriyol tarafından değiştirilir' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tenants_guard_plan before update on public.tenants
  for each row execute function private.guard_tenant_plan();

-- Platform yöneticileri (Hafriyol işletmecisi)
create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
insert into private.platform_admins(user_id)
  select id from auth.users where lower(email) = 'bado607@gmail.com'
  on conflict do nothing;

create function private.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.platform_admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

-- Arayüz için: oturumdaki kullanıcı platform yöneticisi mi?
create function public.am_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_platform_admin(); $$;

-- Firma sahibi ödeme bildirimi yapar (dekont açıklaması vb.)
create function public.notify_payment(p_tenant uuid, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role(p_tenant, '{owner}') then
    raise exception 'Ödeme bildirimi için firma sahibi olmalısınız' using errcode = '42501';
  end if;
  update public.tenants
     set payment_note = left(nullif(trim(p_note), ''), 300), payment_notified_at = now()
   where id = p_tenant;
end;
$$;

-- Platform yöneticisi: firmaları listeler, aktif eder / askıya alır
create function public.admin_tenants()
returns table (id uuid, name text, plan_status text, paid_until date, payment_note text,
               payment_notified_at timestamptz, created_at timestamptz, owner_emails text, member_count bigint)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, t.plan_status, t.paid_until, t.payment_note, t.payment_notified_at, t.created_at,
         (select string_agg(u.email::text, ', ') from public.memberships m join auth.users u on u.id = m.user_id
           where m.tenant_id = t.id and m.role = 'owner'),
         (select count(*) from public.memberships m where m.tenant_id = t.id)
  from public.tenants t
  where private.is_platform_admin()
  order by (t.plan_status = 'pending') desc, t.payment_notified_at desc nulls last, t.created_at desc;
$$;

create function public.admin_set_plan(p_tenant uuid, p_status text, p_paid_until date)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'active', 'suspended') then
    raise exception 'Geçersiz durum' using errcode = 'P0001';
  end if;
  perform set_config('hafriyol.plan_admin', 'on', true);
  update public.tenants
     set plan_status = p_status,
         paid_until = p_paid_until,
         activated_at = case when p_status = 'active' then coalesce(activated_at, now()) else activated_at end
   where id = p_tenant;
end;
$$;

-- Davet kodları
create table public.invite_codes (
  code        text primary key check (code ~ '^[A-Z2-9]{8}$'),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        public.member_role not null,
  label       text check (length(label) <= 100),   -- ör. "Kamyon şoförleri", "Ahmet Usta"
  created_by  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  max_uses    integer check (max_uses between 1 and 1000),
  uses        integer not null default 0,
  revoked     boolean not null default false
);
create index invite_codes_tenant_idx on public.invite_codes(tenant_id, created_at desc);

create table public.invite_uses (
  code      text not null references public.invite_codes(code) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  used_at   timestamptz not null default now(),
  primary key (code, user_id)
);
create index invite_uses_tenant_idx on public.invite_uses(tenant_id);

alter table public.invite_codes enable row level security;
alter table public.invite_uses enable row level security;

-- Sahip tüm kodları, yönetici yalnızca saha personeli kodlarını görür ve iptal eder
create policy invite_codes_select on public.invite_codes for select to authenticated
  using (private.has_role(tenant_id, '{owner}') or (role = 'field' and private.has_role(tenant_id, '{manager}')));
create policy invite_codes_update on public.invite_codes for update to authenticated
  using (private.has_role(tenant_id, '{owner}') or (role = 'field' and private.has_role(tenant_id, '{manager}')))
  with check (private.has_role(tenant_id, '{owner}') or (role = 'field' and private.has_role(tenant_id, '{manager}')));
create policy invite_uses_select on public.invite_uses for select to authenticated
  using (private.has_role(tenant_id, '{owner,manager}'));

revoke all on public.invite_codes, public.invite_uses from anon;
grant select, update on public.invite_codes to authenticated;
grant select on public.invite_uses to authenticated;

create trigger audit_invite_codes after insert or update or delete on public.invite_codes
  for each row execute function public.write_audit_log();

-- write_audit_log record_id için uuid bekler; kodun anahtarı metin olduğundan audit kaydında
-- record_id olarak firma kimliği kullanılır
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
    coalesce(v_row ->> 'id', v_row ->> 'work_item_id', v_row ->> 'route_id', v_row ->> 'vehicle_id', v_row ->> 'tenant_id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;
revoke execute on function public.write_audit_log() from authenticated, anon, public;

-- Kod üretir: sahip her rol, yönetici yalnızca saha personeli. Karışan harfler (0/O, 1/I) kullanılmaz.
create function public.create_invite(p_tenant uuid, p_role public.member_role, p_label text, p_days integer, p_max_uses integer)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not (private.has_role(p_tenant, '{owner}') or (p_role = 'field' and private.has_role(p_tenant, '{manager}'))) then
    raise exception 'Bu rol için kod oluşturma yetkiniz yok' using errcode = '42501';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 365) then
    raise exception 'Geçerlilik 1–365 gün olmalı' using errcode = 'P0001';
  end if;
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.invite_codes where code = v_code);
  end loop;
  insert into public.invite_codes(code, tenant_id, role, label, expires_at, max_uses)
  values (v_code, p_tenant, p_role, nullif(trim(p_label), ''),
          case when p_days is null then null else now() + make_interval(days => p_days) end, p_max_uses);
  return v_code;
end;
$$;

-- Kodla katılma: geçerli koddaki firmaya o rolle üye olunur (zaten üyeyse rol düşürülmez)
create function public.join_with_code(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invite_codes;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Oturum açmanız gerekiyor' using errcode = '42501';
  end if;
  select * into v_inv from public.invite_codes
   where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
   for update;
  if not found or v_inv.revoked or (v_inv.expires_at is not null and v_inv.expires_at < now())
     or (v_inv.max_uses is not null and v_inv.uses >= v_inv.max_uses) then
    raise exception 'Kod geçersiz ya da süresi dolmuş. Kodu veren kişiye danışın.' using errcode = 'P0001';
  end if;
  select plan_status into v_status from public.tenants where id = v_inv.tenant_id;
  if v_status <> 'active' then
    raise exception 'Bu firmanın Hafriyol aboneliği henüz aktif değil' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.memberships where tenant_id = v_inv.tenant_id and user_id = auth.uid()) then
    return v_inv.tenant_id;
  end if;
  insert into public.memberships(tenant_id, user_id, role) values (v_inv.tenant_id, auth.uid(), v_inv.role);
  insert into public.invite_uses(code, tenant_id, user_id) values (v_inv.code, v_inv.tenant_id, auth.uid());
  update public.invite_codes set uses = uses + 1 where code = v_inv.code;
  return v_inv.tenant_id;
end;
$$;

-- Kullanıcı listesi: sahip ve yönetici görür (yönetici saha personelini yönetebilsin)
create or replace function public.tenant_members(p_tenant uuid)
returns table (user_id uuid, email text, role public.member_role, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant and private.has_role(p_tenant, '{owner,manager}')
  order by m.created_at;
$$;

-- Yönetici firmanın üyeliklerini görür ve saha personelini çıkarabilir (rol değiştirme yalnız sahipte)
create policy memberships_manager_select on public.memberships for select to authenticated
  using (private.has_role(tenant_id, '{manager}'));
create policy memberships_manager_remove_field on public.memberships for delete to authenticated
  using (role = 'field' and private.has_role(tenant_id, '{manager}'));

revoke execute on function public.am_platform_admin() from public, anon;
grant execute on function public.am_platform_admin() to authenticated;
revoke execute on function public.notify_payment(uuid, text) from public, anon;
revoke execute on function public.admin_tenants() from public, anon;
revoke execute on function public.admin_set_plan(uuid, text, date) from public, anon;
revoke execute on function public.create_invite(uuid, public.member_role, text, integer, integer) from public, anon;
revoke execute on function public.join_with_code(text) from public, anon;
grant execute on function public.notify_payment(uuid, text) to authenticated;
grant execute on function public.admin_tenants() to authenticated;
grant execute on function public.admin_set_plan(uuid, text, date) to authenticated;
grant execute on function public.create_invite(uuid, public.member_role, text, integer, integer) to authenticated;
grant execute on function public.join_with_code(text) to authenticated;
