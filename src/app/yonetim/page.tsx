import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDateTR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PlanButtons } from "./plan-buttons";

export const metadata = { title: "Hafriyol yönetim" };

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: {
    label: "Ödeme bekliyor",
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  active: {
    label: "Aktif",
    tone: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
  suspended: {
    label: "Askıda",
    tone: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
};

// Yalnızca Hafriyol işletmecisi: firmaların abonelik durumu ve ödeme bildirimleri
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { data: admin } = await supabase.rpc("am_platform_admin");
  if (!admin) notFound();
  const { data: tenants, error } = await supabase.rpc("admin_tenants");
  if (error) throw new Error("Firmalar alınamadı");

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hafriyol yönetim</h1>
        <Link href="/basla" className="link text-sm">
          Geri
        </Link>
      </div>
      <p className="text-sm text-muted">
        Havale/EFT gelince firmayı aktif edin; firma sahibi uygulamaya
        girdiğinde çalışmaya başlar.
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {tenants.map((t) => {
          const s = STATUS[t.plan_status] ?? STATUS.pending;
          return (
            <li key={t.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{t.name}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}
                >
                  {s.label}
                  {t.paid_until && ` · ${formatDateTR(t.paid_until)}'e kadar`}
                </span>
              </div>
              <p className="text-muted">
                {t.owner_emails ?? "sahip yok"} · {Number(t.member_count)}{" "}
                kullanıcı · {formatDateTR(t.created_at)} açıldı
              </p>
              {t.payment_notified_at && (
                <p className="rounded-lg bg-bg p-2">
                  Ödeme bildirimi {formatDateTR(t.payment_notified_at)}
                  {t.payment_note ? `: “${t.payment_note}”` : ""}
                </p>
              )}
              <PlanButtons id={t.id} status={t.plan_status} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
