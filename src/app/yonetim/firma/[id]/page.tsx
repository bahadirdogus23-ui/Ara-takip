import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/context";
import { formatDateTR, formatDateTimeTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";
import { SITE_STATUSES } from "@/lib/validation";
import { PlanButtons } from "../../plan-buttons";
import { Badge, PLAN_STATUS, requireAdmin } from "../../shared";

export const metadata = { title: "Firma ayrıntısı · Hafriyol yönetim" };

export default async function AdminTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAdmin();
  const [list, members, sites] = await Promise.all([
    supabase.rpc("admin_tenant_list"),
    supabase.rpc("admin_tenant_members", { p_tenant: id }),
    supabase.rpc("admin_tenant_sites", { p_tenant: id }),
  ]);
  if (list.error || members.error || sites.error)
    throw new Error("Firma bilgisi alınamadı");
  const t = list.data.find((x) => x.id === id);
  if (!t) notFound();
  const s = PLAN_STATUS[t.plan_status] ?? PLAN_STATUS.pending;
  const n = (v: number) => formatTrNumber(Number(v), 0);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Link href="/yonetim" className="link text-sm">
        ← Hafriyol yönetim
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-muted">
            {formatDateTR(t.created_at)} açıldı
            {t.activated_at &&
              ` · ${formatDateTR(t.activated_at)} aktif edildi`}
          </p>
        </div>
        <Badge tone={s.tone}>
          {s.label}
          {t.paid_until && ` · ${formatDateTR(t.paid_until)}'e kadar`}
        </Badge>
      </div>

      <section className="card space-y-3 text-sm">
        <h2 className="font-semibold">Abonelik</h2>
        {t.payment_notified_at ? (
          <p className="rounded-lg bg-bg p-2">
            Ödeme bildirimi {formatDateTimeTR(t.payment_notified_at)}
            {t.payment_note ? `: “${t.payment_note}”` : ""}
          </p>
        ) : (
          <p className="text-muted">Ödeme bildirimi yok.</p>
        )}
        <PlanButtons id={t.id} status={t.plan_status} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Kullanıcı", t.member_count],
          ["Şantiye", t.site_count],
          ["Araç", t.vehicle_count],
          ["Son 30 gün sefer", t.trips_30d],
        ].map(([label, value]) => (
          <div key={label as string} className="card">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {n(value as number)}
            </p>
          </div>
        ))}
      </section>
      <p className="text-sm text-muted">
        Son işlem: {formatDateTimeTR(t.last_activity)}
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Kullanıcılar</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {members.data.map((m) => (
            <li key={m.user_id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium break-all">{m.email}</p>
                <Badge tone="border border-line">{ROLE_LABELS[m.role]}</Badge>
                {!m.confirmed && (
                  <Badge tone={PLAN_STATUS.pending.tone}>
                    E-posta doğrulanmadı
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                {formatDateTR(m.joined_at)} katıldı · son giriş{" "}
                {m.last_sign_in_at
                  ? formatDateTimeTR(m.last_sign_in_at)
                  : "hiç"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Şantiyeler</h2>
        {sites.data.length === 0 ? (
          <p className="card text-sm text-muted">Henüz şantiye yok.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {sites.data.map((x) => (
              <li key={x.id} className="space-y-1 px-4 py-3 text-sm">
                <p className="font-medium">
                  {x.name}{" "}
                  <span className="text-xs font-normal text-muted">
                    ·{" "}
                    {SITE_STATUSES[x.status as keyof typeof SITE_STATUSES] ??
                      x.status}
                    {x.locked_until &&
                      ` · ${formatDateTR(x.locked_until)}'e kadar kilitli`}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  Son 30 gün {n(x.trips_30d)} sefer · son sefer{" "}
                  {formatDateTimeTR(x.last_trip_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
