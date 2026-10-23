"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow, isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, routeSchema, toFieldErrors, workItemSchema, type FormState } from "@/lib/validation";

// İş kalemi ve güzergâh, ikisi de bir şantiyeye bağlı tanımlardır; yetki ve
// şantiye kontrolü ortak.
async function prepare(formData: FormData) {
  const values = formValues(formData);
  const ctx = await getContext();
  if (!canManage(ctx.tenant.role)) return { values, fail: { error: "Bu işlem için yetkiniz yok", values } };
  if (!isUuid(values.site_id)) return { values, fail: { error: "Şantiye bulunamadı", values } };
  return { values, ctx, siteId: values.site_id, editId: isUuid(values.id) ? values.id : null };
}

function done(siteId: string, values: Record<string, string>, edited: boolean): FormState {
  revalidatePath(`/santiyeler/${siteId}`);
  // Yeni kayıtta form boşalır; düzenlemede girilen değerler kalır
  return { ok: randomUUID(), message: "Kaydedildi", values: edited ? values : undefined };
}

export async function saveWorkItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await prepare(formData);
  if (p.fail) return p.fail;
  const parsed = workItemSchema.safeParse(p.values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values: p.values };

  const { supabase, tenant } = p.ctx;
  const row = { ...parsed.data, tenant_id: tenant.id, site_id: p.siteId };
  const { error } = p.editId
    ? await supabase.from("work_items").update(row).eq("id", p.editId).eq("tenant_id", tenant.id).select("id").single()
    : await supabase.from("work_items").insert(row).select("id").single();
  if (error) return { error: dbErrorMessage(error), values: p.values };
  return done(p.siteId, p.values, !!p.editId);
}

export async function saveRoute(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await prepare(formData);
  if (p.fail) return p.fail;
  const parsed = routeSchema.safeParse(p.values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values: p.values };

  const { supabase, tenant } = p.ctx;
  const row = { ...parsed.data, tenant_id: tenant.id, site_id: p.siteId };
  const { error } = p.editId
    ? await supabase.from("routes").update(row).eq("id", p.editId).eq("tenant_id", tenant.id).select("id").single()
    : await supabase.from("routes").insert(row).select("id").single();
  if (error) return { error: dbErrorMessage(error), values: p.values };
  return done(p.siteId, p.values, !!p.editId);
}

export async function deleteWorkItem(_prev: FormState, formData: FormData) {
  return deleteRow("work_items", formData, ["/santiyeler/[id]"]);
}

export async function deleteRoute(_prev: FormState, formData: FormData) {
  return deleteRow("routes", formData, ["/santiyeler/[id]"]);
}
