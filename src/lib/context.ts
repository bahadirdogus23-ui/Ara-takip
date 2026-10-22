import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { MemberRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const TENANT_COOKIE = "hafriyol_firma";

export type TenantOption = { id: string; name: string; role: MemberRole };

export const canManage = (role: MemberRole) => role === "owner" || role === "manager";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Firma sahibi",
  manager: "Yönetici",
  field: "Saha personeli",
};

// Oturumdaki kullanıcı ve çalıştığı firma. Çerezdeki firma, kullanıcının gerçekten
// üyesi olduğu firmalar arasından seçilir; değilse ilk firmaya düşülür.
// Asıl koruma veritabanındaki RLS'tir; bu yalnızca arayüzün hangi firmayı göstereceğidir.
export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const [{ data: memberships, error: mErr }, { data: tenants, error: tErr }] = await Promise.all([
    supabase.from("memberships").select("tenant_id, role").eq("user_id", user.id),
    supabase.from("tenants").select("id, name").order("name"),
  ]);
  if (mErr || tErr) throw new Error("Firma bilgileri alınamadı");

  const options: TenantOption[] = (tenants ?? []).flatMap((t) => {
    const m = memberships?.find((x) => x.tenant_id === t.id);
    return m ? [{ id: t.id, name: t.name, role: m.role }] : [];
  });
  if (options.length === 0) redirect("/firma-olustur");

  const wanted = (await cookies()).get(TENANT_COOKIE)?.value;
  const tenant = options.find((o) => o.id === wanted) ?? options[0];

  return { supabase, user, tenant, tenants: options };
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
