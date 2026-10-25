"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { parseVehicleLines, WORK_ITEM_TEMPLATES } from "@/lib/setup";
import { SITE_COOKIE } from "@/lib/site-pref";
import { formValues, type FormState } from "@/lib/validation";

// Tek formda: şantiye + seçilen hazır iş kalemleri + alt alta yazılan araçlar
export async function quickSetup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role)) return { error: "Kurulum için firma sahibi veya yönetici olmalısınız", values };

  const name = (values.site_name ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 200) fieldErrors.site_name = "Şantiye adı en az 2 karakter olmalı";
  const { vehicles, errors } = parseVehicleLines(values.vehicles ?? "");
  if (errors.length) fieldErrors.vehicles = errors.join(" · ");
  const items = WORK_ITEM_TEMPLATES.filter((t) => formData.get(`item_${t.key}`) === "on");
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const employer = (values.employer ?? "").trim() || null;
  const { data: site, error } = await supabase
    .from("sites")
    .insert({ tenant_id: tenant.id, name, employer })
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error), values };

  if (items.length) {
    const { error: e } = await supabase
      .from("work_items")
      .insert(items.map((t) => ({ tenant_id: tenant.id, site_id: site.id, name: t.name, unit: t.unit })));
    if (e) return { error: `Şantiye açıldı ama iş kalemleri eklenemedi: ${dbErrorMessage(e)}`, values };
  }

  // Araçlar firma geneli; zaten kayıtlı plakalar atlanır
  if (vehicles.length) {
    const { data: existing } = await supabase.from("vehicles").select("plate").eq("tenant_id", tenant.id);
    const known = new Set(existing?.map((v) => v.plate));
    const fresh = vehicles.filter((v) => !known.has(v.plate));
    if (fresh.length) {
      const { error: e } = await supabase.from("vehicles").insert(fresh.map((v) => ({ ...v, tenant_id: tenant.id })));
      if (e) return { error: `Şantiye açıldı ama araçlar eklenemedi: ${dbErrorMessage(e)}`, values };
    }
  }

  (await cookies()).set(SITE_COOKIE, site.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(vehicles.length ? "/sefer?hazir=1" : "/panel?hazir=1");
}
