-- Hafriyol yönetim ekranı: platform yöneticisi için özet, firma listesi, firma ayrıntısı ve
-- kullanıcı listesi. Tüm fonksiyonlar yalnızca platform yöneticisine veri döner
-- (private.is_platform_admin); diğer kullanıcılar boş sonuç alır. Yalnızca yeni fonksiyonlar.

create or replace function public.admin_overview()
returns table (
  tenants_total      bigint,
  tenants_active     bigint,
  tenants_pending    bigint,
  tenants_suspended  bigint,
  payment_notices    bigint,
  users_total        bigint,
  users_unconfirmed  bigint,
  trips_30d          bigint,
  active_tenants_7d  bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.tenants),
    (select count(*) from public.tenants where plan_status = 'active'),
    (select count(*) from public.tenants where plan_status = 'pending'),
    (select count(*) from public.tenants where plan_status = 'suspended'),
    (select count(*) from public.tenants where plan_status = 'pending' and payment_notified_at is not null),
    (select count(*) from auth.users),
    (select count(*) from auth.users where email_confirmed_at is null),
    (select coalesce(sum(trip_count), 0) from public.trip_entries
      where entry_date >= private.today_tr() - 30),
    (select count(distinct tenant_id) from (
       select tenant_id from public.trip_entries where created_at >= now() - interval '7 days'
       union all select tenant_id from public.production_entries where created_at >= now() - interval '7 days'
       union all select tenant_id from public.machine_logs where created_at >= now() - interval '7 days'
       union all select tenant_id from public.expenses where created_at >= now() - interval '7 days'
     ) a)
  where private.is_platform_admin();
$$;

create or replace function public.admin_tenant_list()
returns table (
  id                  uuid,
  name                text,
  plan_status         text,
  paid_until          date,
  payment_note        text,
  payment_notified_at timestamptz,
  created_at          timestamptz,
  activated_at        timestamptz,
  owner_emails        text,
  member_count        bigint,
  site_count          bigint,
  vehicle_count       bigint,
  trips_30d           bigint,
  last_activity       timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, t.plan_status, t.paid_until, t.payment_note, t.payment_notified_at,
         t.created_at, t.activated_at,
         (select string_agg(u.email::text, ', ') from public.memberships m join auth.users u on u.id = m.user_id
           where m.tenant_id = t.id and m.role = 'owner'),
         (select count(*) from public.memberships m where m.tenant_id = t.id),
         (select count(*) from public.sites s where s.tenant_id = t.id),
         (select count(*) from public.vehicles v where v.tenant_id = t.id),
         (select coalesce(sum(te.trip_count), 0) from public.trip_entries te
           where te.tenant_id = t.id and te.entry_date >= private.today_tr() - 30),
         greatest(
           (select max(created_at) from public.trip_entries x where x.tenant_id = t.id),
           (select max(created_at) from public.production_entries x where x.tenant_id = t.id),
           (select max(created_at) from public.machine_logs x where x.tenant_id = t.id),
           (select max(created_at) from public.expenses x where x.tenant_id = t.id)
         )
  from public.tenants t
  where private.is_platform_admin()
  order by (t.plan_status = 'pending' and t.payment_notified_at is not null) desc,
           (t.plan_status = 'pending') desc, t.payment_notified_at desc nulls last, t.created_at desc;
$$;

create or replace function public.admin_tenant_members(p_tenant uuid)
returns table (
  user_id         uuid,
  email           text,
  role            public.member_role,
  joined_at       timestamptz,
  last_sign_in_at timestamptz,
  confirmed       boolean
)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text, m.role, m.created_at, u.last_sign_in_at, u.email_confirmed_at is not null
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant and private.is_platform_admin()
  order by m.role, u.email;
$$;

create or replace function public.admin_tenant_sites(p_tenant uuid)
returns table (
  id           uuid,
  name         text,
  status       text,
  locked_until date,
  trips_30d    bigint,
  last_trip_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.name, s.status, s.locked_until,
         (select coalesce(sum(te.trip_count), 0) from public.trip_entries te
           where te.site_id = s.id and te.entry_date >= private.today_tr() - 30),
         (select max(te.created_at) from public.trip_entries te where te.site_id = s.id)
  from public.sites s
  where s.tenant_id = p_tenant and private.is_platform_admin()
  order by s.status, s.name;
$$;

create or replace function public.admin_users()
returns table (
  user_id         uuid,
  email           text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  confirmed       boolean,
  platform_admin  boolean,
  memberships     text
)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
         exists (select 1 from private.platform_admins p where p.user_id = u.id),
         (select string_agg(t.name || ' (' || m.role::text || ')', ', ' order by t.name)
            from public.memberships m join public.tenants t on t.id = m.tenant_id
           where m.user_id = u.id)
  from auth.users u
  where private.is_platform_admin()
  order by u.created_at desc;
$$;

revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_tenant_list() from public, anon;
revoke execute on function public.admin_tenant_members(uuid) from public, anon;
revoke execute on function public.admin_tenant_sites(uuid) from public, anon;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_tenant_list() to authenticated;
grant execute on function public.admin_tenant_members(uuid) to authenticated;
grant execute on function public.admin_tenant_sites(uuid) to authenticated;
grant execute on function public.admin_users() to authenticated;
