import { History } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AUDIT_GROUPS, describeAudit, type AuditEntry } from "@/lib/audit";
import { canManage, getContext } from "@/lib/context";
import { formatDateTimeTR } from "@/lib/format";

export const metadata = { title: "İşlem geçmişi" };

const PAGE = 50;

// Kim neyi değiştirdi: firma sahibi ve yönetici görür (veritabanı da denetler)
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ grup?: string; once?: string }>;
}) {
  const { grup, once } = await searchParams;
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/panel");
  const group = grup && AUDIT_GROUPS[grup] ? grup : "";
  const before = once && /^\d+$/.test(once) ? Number(once) : null;

  const [feed, sites, items, routes, vehicles] = await Promise.all([
    supabase.rpc("audit_feed", {
      p_tenant: tenant.id,
      p_tables: group ? AUDIT_GROUPS[group].tables : null,
      p_before: before,
      p_limit: PAGE,
    }),
    supabase.from("sites").select("id, name").eq("tenant_id", tenant.id),
    supabase.from("work_items").select("id, name").eq("tenant_id", tenant.id),
    supabase.from("routes").select("id, name").eq("tenant_id", tenant.id),
    supabase.from("vehicles").select("id, plate").eq("tenant_id", tenant.id),
  ]);
  if (feed.error) throw new Error("İşlem geçmişi alınamadı");
  // Kayıtlardaki kimlikler ad/plaka ile gösterilir
  const names = new Map<string, string>([
    ...(sites.data ?? []).map((x) => [x.id, x.name] as [string, string]),
    ...(items.data ?? []).map((x) => [x.id, x.name] as [string, string]),
    ...(routes.data ?? []).map((x) => [x.id, x.name] as [string, string]),
    ...(vehicles.data ?? []).map((x) => [x.id, x.plate] as [string, string]),
  ]);
  const rows = feed.data as AuditEntry[];
  const href = (q: Record<string, string>) =>
    `/islem-gecmisi?${new URLSearchParams(q)}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <History className="size-6 text-brand" aria-hidden /> İşlem geçmişi
      </h1>
      <p className="text-sm text-muted">
        Kayıt, ücret, tanım ve kullanıcı değişiklikleri: kim, ne zaman, neyi
        değiştirdi.
      </p>

      <nav
        aria-label="Süzgeç"
        className="flex gap-2 overflow-x-auto pb-1 text-sm font-medium"
      >
        {[
          ["", "Tümü"],
          ...Object.entries(AUDIT_GROUPS).map(([k, g]) => [k, g.label]),
        ].map(([key, label]) => (
          <Link
            key={key || "tumu"}
            href={key ? href({ grup: key }) : "/islem-gecmisi"}
            aria-current={group === key ? "page" : undefined}
            className={`min-h-10 shrink-0 rounded-full border px-4 py-2 ${
              group === key
                ? "border-brand bg-brand text-white dark:text-black"
                : "border-line bg-surface"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="card text-sm text-muted">Bu süzgeçte işlem yok.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((r) => {
            const line = describeAudit(r, names);
            return (
              <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{line.title}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {formatDateTimeTR(r.changed_at)}
                  </p>
                </div>
                <p className="text-xs break-all text-muted">{line.who}</p>
                {line.details.length > 0 && (
                  <ul className="text-muted">
                    {line.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length === PAGE && (
        <Link
          href={href({
            ...(group ? { grup: group } : {}),
            once: String(rows[rows.length - 1].id),
          })}
          className="btn-secondary w-full"
        >
          Daha eski işlemler
        </Link>
      )}
    </div>
  );
}
