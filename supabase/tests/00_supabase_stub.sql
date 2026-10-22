-- Yerel test için Supabase ortamının en küçük taklidi.
-- Gerçek Supabase'te bu nesneler zaten vardır; bu dosya oraya UYGULANMAZ.

create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id    uuid primary key,
  email text
);

-- Supabase'teki gibi: oturumdaki kullanıcının kimliği JWT'den okunur.
create function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated;
