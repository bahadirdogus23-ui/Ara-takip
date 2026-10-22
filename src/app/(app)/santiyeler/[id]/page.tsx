import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { canManage, getContext } from "@/lib/context";
import { formatDateTR } from "@/lib/format";
import { SiteForm } from "../site-form";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kaydedildi?: string }>;
}) {
  const [{ id }, { kaydedildi }] = await Promise.all([params, searchParams]);
  const { supabase, tenant } = await getContext();

  // Geçersiz kimlik veya başka firmanın şantiyesi: RLS satırı göstermez → 404
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: site } = await supabase.from("sites").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/santiyeler" className="link text-sm">
        ← Şantiyeler
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">{site.name}</h1>
        <StatusBadge status={site.status} />
      </div>
      {kaydedildi && (
        <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Kaydedildi.
        </p>
      )}

      {canManage(tenant.role) ? (
        <div className="card">
          <SiteForm site={site} />
        </div>
      ) : (
        <dl className="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Kod</dt>
          <dd>{site.code ?? "—"}</dd>
          <dt className="text-muted">İşveren</dt>
          <dd>{site.employer ?? "—"}</dd>
          <dt className="text-muted">Konum</dt>
          <dd>{site.location ?? "—"}</dd>
          <dt className="text-muted">Tarihler</dt>
          <dd>
            {formatDateTR(site.start_date)} – {formatDateTR(site.end_date)}
          </dd>
        </dl>
      )}
    </div>
  );
}
