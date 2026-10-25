#!/usr/bin/env bash
# Uçtan uca testler için Supabase'in yerel bir kopyasını başlatır:
# PostgreSQL + Supabase Auth (GoTrue) + PostgREST + basit ağ geçidi.
# Docker gerektirmez. İkili dosyalar ilk çalıştırmada .e2e/bin altına indirilir.
#
#   ./scripts/e2e-stack.sh        # başlatır, .e2e/env dosyasına adresleri yazar
#   ./scripts/e2e-stack.sh stop   # durdurur ve verileri siler
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
E2E="$ROOT/.e2e"
BIN="$E2E/bin"
DATA="$E2E/pg"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
PG_PORT=54339 AUTH_PORT=54398 REST_PORT=54397 STORAGE_PORT=54396 API_PORT=54321
JWT_SECRET="yerel-test-icin-gizli-anahtar-en-az-32-karakter"
POSTGREST_VERSION=v12.2.3
AUTH_VERSION=v2.169.0

as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

stop() {
  [ -f "$E2E/pids" ] && xargs -r kill < "$E2E/pids" 2>/dev/null || true
  [ -d "$DATA" ] && as_pg "'$PG_BIN/pg_ctl' -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$DATA" "$E2E/pids" "$E2E/env" "$E2E/sock"
}

if [ "${1:-}" = "stop" ]; then stop; echo "Durduruldu."; exit 0; fi
stop

mkdir -p "$BIN"
if [ ! -x "$BIN/postgrest" ]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar xJ -C "$BIN"
fi
if [ ! -x "$BIN/auth" ]; then
  curl -fsSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" | tar xz -C "$BIN"
fi

# --- PostgreSQL ---
mkdir -p "$E2E/sock"
[ "$(id -u)" = "0" ] && chown postgres "$E2E" "$E2E/sock"
as_pg "'$PG_BIN/initdb' -D '$DATA' -U postgres -E UTF8 --locale=C.UTF-8 -A trust" >/dev/null
as_pg "'$PG_BIN/pg_ctl' -D '$DATA' -o '-p $PG_PORT -k $E2E/sock -c listen_addresses=127.0.0.1' -l '$E2E/pg.log' -w start" >/dev/null
PSQL=("$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

# Supabase'teki rollerin en küçük karşılığı
"${PSQL[@]}" <<SQL
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema public to anon, authenticated, service_role;
SQL

# --- Supabase Auth: kendi tablolarını (auth.users, auth.uid() …) kurar ---
export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:$PG_PORT/postgres?sslmode=disable"
export GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
export GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_JWT_EXP=3600
export API_EXTERNAL_URL="http://127.0.0.1:$API_PORT/auth/v1" GOTRUE_SITE_URL="http://localhost:3000"
export GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**"
export GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_SMTP_ADMIN_EMAIL=test@hafriyol.local
export GOTRUE_API_HOST=127.0.0.1 PORT=$AUTH_PORT GOTRUE_LOG_LEVEL=warn
"$BIN/auth" migrate > "$E2E/auth-migrate.log" 2>&1
"$BIN/auth" serve > "$E2E/auth.log" 2>&1 &
echo $! >> "$E2E/pids"

# --- Supabase Storage (isteğe bağlı: ./scripts/e2e-storage-build.sh ile derlenmişse) ---
SERVICE_KEY=$(node -e '
const c=require("crypto"),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"service_role",iss:"supabase",iat:1700000000,exp:2000000000});
console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$JWT_SECRET")
if [ -f "$E2E/storage/dist/start/server.js" ]; then
  mkdir -p "$E2E/files"
  (
    cd "$E2E/storage"
    SERVER_PORT=$STORAGE_PORT SERVER_HOST=127.0.0.1 AUTH_JWT_SECRET="$JWT_SECRET" AUTH_JWT_ALGORITHM=HS256 \
    ANON_KEY=unused SERVICE_KEY="$SERVICE_KEY" \
    DATABASE_URL="postgres://postgres@127.0.0.1:$PG_PORT/postgres" DB_INSTALL_ROLES=false \
    STORAGE_BACKEND=file STORAGE_FILE_BACKEND_PATH="$E2E/files" STORAGE_S3_BUCKET=hafriyol \
    TENANT_ID=yerel REGION=yerel UPLOAD_FILE_SIZE_LIMIT=10485760 IMAGE_TRANSFORMATION_ENABLED=false LOG_LEVEL=warn \
    NODE_ENV=production node dist/start/server.js > "$E2E/storage.log" 2>&1 < /dev/null &
    echo $! >> "$E2E/pids"
  )
  for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$STORAGE_PORT/status" >/dev/null && break; sleep 0.5; done
  curl -sf "http://127.0.0.1:$STORAGE_PORT/status" >/dev/null || { echo "Storage başlamadı:"; tail -20 "$E2E/storage.log"; exit 1; }
  # Roller zaten var (Supabase'teki gibi); storage şemasına erişim yetkileri
  "${PSQL[@]}" <<SQL
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant all on all functions in schema storage to anon, authenticated, service_role;
grant all on all sequences in schema storage to anon, authenticated, service_role;
SQL
fi

# --- Uygulamanın şeması ---
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done

# --- PostgREST ---
PGRST_DB_URI="postgres://authenticator@127.0.0.1:$PG_PORT/postgres" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$REST_PORT PGRST_LOG_LEVEL=warn \
  "$BIN/postgrest" > "$E2E/rest.log" 2>&1 &
echo $! >> "$E2E/pids"

node "$ROOT/scripts/e2e-gateway.mjs" $API_PORT $AUTH_PORT $REST_PORT $STORAGE_PORT > "$E2E/gateway.log" 2>&1 &
echo $! >> "$E2E/pids"

# Supabase'teki "anon" anahtarının karşılığı: anon rolüyle imzalı JWT
ANON_KEY=$(node -e '
const c=require("crypto"),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"supabase",iat:1700000000,exp:2000000000});
console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$JWT_SECRET")

for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$API_PORT/auth/v1/health" >/dev/null && curl -sf "http://127.0.0.1:$API_PORT/rest/v1/" -H "apikey: $ANON_KEY" >/dev/null && break
  sleep 0.3
done

cat > "$E2E/env" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$API_PORT
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV
echo "Yerel yığın hazır: http://127.0.0.1:$API_PORT (ayarlar: .e2e/env)"
