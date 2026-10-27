"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow, isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { isoDateTR } from "@/lib/format";
import { saveItemPrice, saveRoutePrice, validFrom } from "@/lib/prices";
import {
  formValues,
  routeSchema,
  toFieldErrors,
  workItemSchema,
  type FormState,
} from "@/lib/validation";

// İş kalemi ve güzergâh, ikisi de bir şantiyeye bağlı tanımlardır; yetki ve
// şantiye kontrolü ortak.
async function prepare(formData: FormData) {
  const values = formValues(formData);
  const ctx = await getContext();
  if (!canManage(ctx.tenant.role))
    return { values, fail: { error: "Bu işlem için yetkiniz yok", values } };
  if (!isUuid(values.site_id))
    return { values, fail: { error: "Şantiye bulunamadı", values } };
  return {
    values,
    ctx,
    siteId: values.site_id,
    editId: isUuid(values.id) ? values.id : null,
  };
}

function done(
  siteId: string,
  values: Record<string, string>,
  edited: boolean,
): FormState {
  revalidatePath(`/santiyeler/${siteId}`);
  // Yeni kayıtta form boşalır; düzenlemede girilen değerler kalır
  return {
    ok: randomUUID(),
    message: "Kaydedildi",
    values: edited ? values : undefined,
  };
}

export async function saveWorkItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const p = await prepare(formData);
  if (p.fail) return p.fail;
  const parsed = workItemSchema.safeParse(p.values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values: p.values };

  const { supabase, tenant } = p.ctx;
  // Birim fiyat ayrı tabloda (yalnızca sahibi/yönetici görür), geçerlilik tarihiyle
  const { unit_price, price_from, ...item } = parsed.data;
  const from = validFrom(price_from, isoDateTR());
  if (!from)
    return {
      fieldErrors: {
        price_from: "Ücretin geçerlilik başlangıcı ileri bir tarih olamaz",
      },
      values: p.values,
    };
  const row = { ...item, tenant_id: tenant.id, site_id: p.siteId };
  const { data, error } = p.editId
    ? await supabase
        .from("work_items")
        .update(row)
        .eq("id", p.editId)
        .eq("tenant_id", tenant.id)
        .select("id")
        .single()
    : await supabase.from("work_items").insert(row).select("id").single();
  if (error) return { error: dbErrorMessage(error), values: p.values };
  const price = await saveItemPrice(supabase, {
    work_item_id: data.id,
    tenant_id: tenant.id,
    site_id: p.siteId,
    unit_price,
    valid_from: from,
  });
  if (price.error)
    return { error: dbErrorMessage(price.error), values: p.values };
  return done(p.siteId, p.values, !!p.editId);
}

export async function saveRoute(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const p = await prepare(formData);
  if (p.fail) return p.fail;
  const parsed = routeSchema.safeParse(p.values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values: p.values };

  const { supabase, tenant } = p.ctx;
  // Taşeron sefer ücreti ayrı tabloda (yalnızca sahibi/yönetici görür), geçerlilik tarihiyle
  const { trip_price, price_from, ...route } = parsed.data;
  const from = validFrom(price_from, isoDateTR());
  if (!from)
    return {
      fieldErrors: {
        price_from: "Ücretin geçerlilik başlangıcı ileri bir tarih olamaz",
      },
      values: p.values,
    };
  const row = { ...route, tenant_id: tenant.id, site_id: p.siteId };
  const { data, error } = p.editId
    ? await supabase
        .from("routes")
        .update(row)
        .eq("id", p.editId)
        .eq("tenant_id", tenant.id)
        .select("id")
        .single()
    : await supabase.from("routes").insert(row).select("id").single();
  if (error) return { error: dbErrorMessage(error), values: p.values };
  const price = await saveRoutePrice(supabase, {
    route_id: data.id,
    tenant_id: tenant.id,
    site_id: p.siteId,
    trip_price,
    valid_from: from,
  });
  if (price.error)
    return { error: dbErrorMessage(price.error), values: p.values };
  return done(p.siteId, p.values, !!p.editId);
}

export async function deleteWorkItem(_prev: FormState, formData: FormData) {
  return deleteRow("work_items", formData, ["/santiyeler/[id]"]);
}

export async function deleteRoute(_prev: FormState, formData: FormData) {
  return deleteRow("routes", formData, ["/santiyeler/[id]"]);
}

// Dönem kilidi: seçilen tarihe kadar (dahil) kayıt eklenemez, düzeltilemez, silinemez;
// ücret değişikliği de bu dönemi etkilemez. Kural veritabanında; kilidi geri almak
// yalnızca firma sahibinin yetkisinde.
export async function setPeriodLock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role))
    return { error: "Bu işlem için yetkiniz yok", values };
  if (!isUuid(values.site_id)) return { error: "Şantiye bulunamadı", values };
  const unlock = values.islem === "ac";
  const until = unlock ? null : (values.locked_until ?? "").trim();
  if (!unlock && !/^\d{4}-\d{2}-\d{2}$/.test(until ?? ""))
    return { fieldErrors: { locked_until: "Tarih seçin" }, values };
  if (until && until > isoDateTR())
    return {
      fieldErrors: { locked_until: "Gelecekteki bir tarih kilitlenemez" },
      values,
    };
  const { error } = await supabase
    .from("sites")
    .update({ locked_until: until })
    .eq("id", values.site_id)
    .eq("tenant_id", tenant.id);
  if (error) return { error: dbErrorMessage(error), values };
  revalidatePath(`/santiyeler/${values.site_id}`);
  return {
    ok: randomUUID(),
    message: unlock ? "Kilit kaldırıldı" : "Dönem kilitlendi",
  };
}
