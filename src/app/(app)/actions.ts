"use server";

import { redirect } from "next/navigation";
import { getTenantContext, setActiveTenantCookie } from "@/lib/context";

export async function switchTenant(formData: FormData) {
  const id = String(formData.get("tenant") ?? "");
  // Aboneliği bitmiş firmadan da başka firmaya geçilebilsin
  const { tenants } = await getTenantContext();
  // Yalnızca üyesi olunan firmaya geçilebilir
  if (tenants.some((t) => t.id === id)) await setActiveTenantCookie(id);
  redirect("/panel");
}
