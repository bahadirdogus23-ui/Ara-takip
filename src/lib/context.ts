import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { MemberRole } from "@/lib/database.types";
import { isoDateTR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const TENANT_COOKIE = "hafriyol_firma";

export type TenantOption = {
  id: string;
  name: string;
  role: MemberRole;
  planStatus: "pending" | "active" | "suspended";
  paidUntil: string | null;
};

// Abonelik geçerli mi: aktif ve (varsa) ödeme bitiş tarihi geçmemiş
export const isPlanActive = (
  t: Pick<TenantOption, "planStatus" | "paidUntil">,
  today: string,
) => t.planStatus === "active" && (!t.paidUntil || t.paidUntil >= today);

export const canManage = (role: MemberRole) =>
  role === "owner" || role === "manager";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Firma sahibi",
  manager: "Yönetici",
  field: "Saha personeli",
};

// Oturumdaki kullanıcı ve çalıştığı firma (abonelik durumuna bakmadan). Çerezdeki firma,
// kullanıcının gerçekten üyesi olduğu firmalar arasından seçilir; değilse ilk firmaya düşülür.
// Asıl koruma veritabanındaki RLS'tir; bu yalnızca arayüzün hangi firmayı göstereceğidir.
// Firması olmayan kullanıcı "Davet kodum var / Yeni firma kur" ekranına gider.
export const getTenantContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const [{ data: memberships, error: mErr }, { data: tenants, error: tErr }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("tenant_id, role")
        .eq("user_id", user.id),
      supabase
        .from("tenants")
        .select("id, name, plan_status, paid_until")
        .order("name"),
    ]);
  if (mErr || tErr) throw new Error("Firma bilgileri alınamadı");

  const options: TenantOption[] = (tenants ?? []).flatMap((t) => {
    const m = memberships?.find((x) => x.tenant_id === t.id);
    return m
      ? [
          {
            id: t.id,
            name: t.name,
            role: m.role,
            planStatus: t.plan_status,
            paidUntil: t.paid_until,
          },
        ]
      : [];
  });
  if (options.length === 0) redirect("/basla");

  const wanted = (await cookies()).get(TENANT_COOKIE)?.value;
  const tenant = options.find((o) => o.id === wanted) ?? options[0];

  return { supabase, user, tenant, tenants: options };
});

// Uygulama ekranları ve işlemleri için: firmanın aboneliği geçerli değilse ödeme ekranına
export const getContext = cache(async () => {
  const ctx = await getTenantContext();
  if (!isPlanActive(ctx.tenant, isoDateTR())) redirect("/odeme");
  return ctx;
});

export async function setActiveTenantCookie(tenantId: string) {
  (await cookies()).set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
