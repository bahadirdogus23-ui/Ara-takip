import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { canManage, getContext } from "@/lib/context";
import { formatDateTR } from "@/lib/format";

export const metadata = { title: "Şantiyeler" };

export default async function SitesPage() {
  const { supabase, tenant } = await getContext();
  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, code, employer, location, start_date, end_date, status")
    .eq("tenant_id", tenant.id)
    .order("status")
    .order("name");
  if (error) throw new Error("Şantiyeler alınamadı");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Şantiyeler</h1>
        {canManage(tenant.role) && (
          <Link href="/santiyeler/yeni" className="btn-primary">
            Yeni şantiye
          </Link>
        )}
      </div>

      {sites.length === 0 ? (
        <p className="card text-muted">Henüz şantiye yok.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {sites.map((s) => (
            <li key={s.id}>
              <Link href={`/santiyeler/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-sm text-muted">
                    {[s.code, s.employer, s.location].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTR(s.start_date)} – {formatDateTR(s.end_date)}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
