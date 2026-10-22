"use server";

import { redirect } from "next/navigation";
import { getContext, setActiveTenantCookie } from "@/lib/context";

export async function switchTenant(formData: FormData) {
  const id = String(formData.get("tenant") ?? "");
  const { tenants } = await getContext();
  // Yalnızca üyesi olunan firmaya geçilebilir
  if (tenants.some((t) => t.id === id)) await setActiveTenantCookie(id);
  redirect("/panel");
}
