import Link from "next/link";
import { canManage, getContext } from "@/lib/context";
import { formatTL, monthRangeTR } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Panel" };

export default async function DashboardPage() {
  const { supabase, tenant } = await getContext();
  const { from, to } = monthRangeTR();

  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, code, employer, status")
    .eq("tenant_id", tenant.id)
    .order("status")
    .order("name");
  if (error) throw new Error("Şantiyeler alınamadı");

  const active = (sites ?? []).filter((s) => s.status === "active");

  // Her aktif şantiyenin bu ayki imalat tutarı (veritabanında hesaplanır)
  const totals = await Promise.all(
    active.map(async (s) => {
      const { data } = await supabase.rpc("production_summary", { p_site: s.id, p_from: from, p_to: to });
      return [s.id, (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)] as const;
    }),
  );
  const totalBySite = new Map(totals);
  const monthTotal = totals.reduce((sum, [, v]) => sum + v, 0);
  const manager = canManage(tenant.role);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Aktif şantiye" value={String(active.length)} />
        <Stat label="Bu ay imalat tutarı" value={formatTL(monthTotal)} hint="Sözleşme birim fiyatıyla, KDV hariç" />
        <Stat label="Toplam şantiye" value={String(sites?.length ?? 0)} />
      </div>

      {sites?.length === 0 ? (
        <section className="card">
          <h2 className="text-lg font-bold">Başlarken</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            <li>İlk şantiyenizi ekleyin.</li>
            <li>Şantiyenin iş kalemlerini (poz, birim, birim fiyat) tanımlayın.</li>
            <li>Araçlarınızı ekleyin ve günlük imalat/sefer girmeye başlayın.</li>
          </ol>
          {manager && (
            <Link href="/santiyeler/yeni" className="btn-primary mt-4">
              İlk şantiyeyi ekle
            </Link>
          )}
        </section>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Şantiyeler</h2>
            <Link href="/santiyeler" className="link text-sm">
              Tümü
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sites?.map((s) => (
              <li key={s.id}>
                <Link href={`/santiyeler/${s.id}`} className="card block hover:border-brand">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{s.name}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{[s.code, s.employer].filter(Boolean).join(" · ") || " "}</p>
                  {s.status === "active" && (
                    <p className="mt-3 text-sm">
                      Bu ay: <span className="font-semibold">{formatTL(totalBySite.get(s.id))}</span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
