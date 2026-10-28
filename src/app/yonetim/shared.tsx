import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Yönetim sayfaları yalnızca Hafriyol işletmecisine (platform yöneticisi) açık.
// Veri fonksiyonları da yetkiyi veritabanında ayrıca denetler.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?sonra=/yonetim");
  const [{ data: admin }, { count }] = await Promise.all([
    supabase.rpc("am_platform_admin"),
    supabase
      .from("memberships")
      .select("tenant_id", { count: "exact", head: true }),
  ]);
  if (!admin) notFound();
  // Yöneticinin kendi firması yoksa uygulamaya değil başlangıç sayfasına döner
  return { supabase, backHref: count ? "/panel" : "/basla" };
}

export const PLAN_STATUS: Record<string, { label: string; tone: string }> = {
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

export function Badge({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

export const MUTED_TONE = "bg-bg text-muted border border-line";
