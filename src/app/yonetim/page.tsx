import { Search } from "lucide-react";
import Link from "next/link";
import { formatDateTR, formatDateTimeTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";
import { PlanButtons } from "./plan-buttons";
import { Badge, MUTED_TONE, PLAN_STATUS, requireAdmin } from "./shared";

export const metadata = { title: "Hafriyol yönetim" };

const lower = (v: string | null | undefined) =>
  (v ?? "").toLocaleLowerCase("tr");

// Hafriyol işletmecisinin ekranı: özet, firmalar (abonelik, ödeme bildirimi) ve kullanıcılar
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; q?: string; durum?: string }>;
}) {
  const params = await searchParams;
  const tab = params.sekme === "kullanicilar" ? "kullanicilar" : "firmalar";
  const q = (params.q ?? "").trim().slice(0, 100);
  const durum = params.durum && PLAN_STATUS[params.durum] ? params.durum : "";
  const { supabase, backHref } = await requireAdmin();

  const [overview, tenants, users] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_tenant_list"),
    supabase.rpc("admin_users"),
  ]);
  if (overview.error || tenants.error || users.error)
    throw new Error("Yönetim verisi alınamadı");
  const o = overview.data[0];
  const n = (v: number | undefined) => formatTrNumber(Number(v ?? 0), 0);

  const firms = tenants.data.filter(
    (t) =>
      (!durum || t.plan_status === durum) &&
      (!q ||
        lower(t.name).includes(lower(q)) ||
        lower(t.owner_emails).includes(lower(q))),
  );
  const people = users.data.filter(
    (u) =>
      !q ||
      lower(u.email).includes(lower(q)) ||
      lower(u.memberships).includes(lower(q)),
  );

  const tabLink = (sekme: string) => `/yonetim?sekme=${sekme}`;
  const tabClass = (on: boolean) =>
    `min-h-10 rounded-full px-4 py-2 text-sm font-medium ${
      on
        ? "bg-brand text-white dark:text-black"
        : "border border-line bg-surface"
    }`;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hafriyol yönetim</h1>
        <Link href={backHref} className="link text-sm">
          Geri
        </Link>
      </div>

      <section
        aria-label="Özet"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Stat label="Firma" value={n(o?.tenants_total)}>
          {n(o?.tenants_active)} aktif · {n(o?.tenants_suspended)} askıda
        </Stat>
        <Stat
          label="Ödeme bekliyor"
          value={n(o?.tenants_pending)}
          warn={Number(o?.payment_notices ?? 0) > 0}
        >
          {n(o?.payment_notices)} ödeme bildirimi
        </Stat>
        <Stat label="Kullanıcı" value={n(o?.users_total)}>
          {Number(o?.users_unconfirmed ?? 0) > 0
            ? `${n(o?.users_unconfirmed)} e-postası doğrulanmadı`
            : "hepsi doğrulanmış"}
        </Stat>
        <Stat label="Son 30 gün sefer" value={n(o?.trips_30d)}>
          son 7 günde {n(o?.active_tenants_7d)} firma kayıt girdi
        </Stat>
      </section>

      <nav aria-label="Yönetim sekmeleri" className="flex gap-2">
        <Link
          href={tabLink("firmalar")}
          aria-current={tab === "firmalar" ? "page" : undefined}
          className={tabClass(tab === "firmalar")}
        >
          Firmalar ({n(tenants.data.length)})
        </Link>
        <Link
          href={tabLink("kullanicilar")}
          aria-current={tab === "kullanicilar" ? "page" : undefined}
          className={tabClass(tab === "kullanicilar")}
        >
          Kullanıcılar ({n(users.data.length)})
        </Link>
      </nav>

      <form method="get" className="flex flex-wrap gap-2" role="search">
        <input type="hidden" name="sekme" value={tab} />
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Ara</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder={
              tab === "firmalar"
                ? "Firma adı ya da sahip e-postası"
                : "E-posta ya da firma"
            }
            className="input pl-9"
          />
        </label>
        {tab === "firmalar" && (
          <select
            name="durum"
            defaultValue={durum}
            aria-label="Durum"
            className="input w-auto"
          >
            <option value="">Tüm durumlar</option>
            {Object.entries(PLAN_STATUS).map(([value, s]) => (
              <option key={value} value={value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-secondary">
          Ara
        </button>
      </form>

      {tab === "firmalar" ? (
        firms.length === 0 ? (
          <p className="card text-sm text-muted">Firma bulunamadı.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {firms.map((t) => {
              const s = PLAN_STATUS[t.plan_status] ?? PLAN_STATUS.pending;
              return (
                <li key={t.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/yonetim/firma/${t.id}`}
                      className="font-semibold hover:underline"
                    >
                      {t.name}
                    </Link>
                    <Badge tone={s.tone}>
                      {s.label}
                      {t.paid_until &&
                        ` · ${formatDateTR(t.paid_until)}'e kadar`}
                    </Badge>
                  </div>
                  <p className="text-muted">
                    {t.owner_emails ?? "sahip yok"} · {n(t.member_count)}{" "}
                    kullanıcı · {n(t.site_count)} şantiye · {n(t.vehicle_count)}{" "}
                    araç
                  </p>
                  <p className="text-muted">
                    Son 30 gün {n(t.trips_30d)} sefer · son işlem{" "}
                    {formatDateTimeTR(t.last_activity)} ·{" "}
                    {formatDateTR(t.created_at)} açıldı
                  </p>
                  {t.payment_notified_at && (
                    <p className="rounded-lg bg-bg p-2">
                      Ödeme bildirimi {formatDateTR(t.payment_notified_at)}
                      {t.payment_note ? `: “${t.payment_note}”` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PlanButtons id={t.id} status={t.plan_status} />
                    <Link
                      href={`/yonetim/firma/${t.id}`}
                      className="link text-xs"
                    >
                      Ayrıntı
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : people.length === 0 ? (
        <p className="card text-sm text-muted">Kullanıcı bulunamadı.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {people.map((u) => (
            <li key={u.user_id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold break-all">{u.email}</p>
                {u.platform_admin && (
                  <Badge tone={PLAN_STATUS.active.tone}>Yönetici</Badge>
                )}
                {!u.confirmed && (
                  <Badge tone={PLAN_STATUS.pending.tone}>
                    E-posta doğrulanmadı
                  </Badge>
                )}
              </div>
              <p className="text-muted">
                {u.memberships ? roleText(u.memberships) : "Firması yok"}
              </p>
              <p className="text-xs text-muted">
                Kayıt {formatDateTR(u.created_at)} · son giriş{" "}
                {u.last_sign_in_at
                  ? formatDateTimeTR(u.last_sign_in_at)
                  : "hiç"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className={`rounded-lg p-2 text-xs ${MUTED_TONE}`}>
        Havale/EFT gelince firmayı aktif edin; firma sahibi uygulamaya
        girdiğinde çalışmaya başlar.
      </p>
    </main>
  );
}

// "Firma (owner)" → "Firma (firma sahibi)"
const ROLE_TR: Record<string, string> = {
  owner: "firma sahibi",
  manager: "yönetici",
  field: "saha personeli",
};
const roleText = (s: string) =>
  s.replace(/\((owner|manager|field)\)/g, (_, r: string) => `(${ROLE_TR[r]})`);

function Stat({
  label,
  value,
  warn,
  children,
}: {
  label: string;
  value: string;
  warn?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`card ${warn ? "border-amber-400 dark:border-amber-700" : ""}`}
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {children && <p className="mt-1 text-xs text-muted">{children}</p>}
    </div>
  );
}
