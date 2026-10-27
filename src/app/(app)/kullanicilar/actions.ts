"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/actions";
import { getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import {
  formValues,
  memberSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

export async function addMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = memberSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const { supabase, tenant } = await getContext();
  // Yetki (yalnızca firma sahibi) veritabanı fonksiyonunda kontrol edilir
  const { error } = await supabase.rpc("add_member", {
    p_tenant: tenant.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { error: dbErrorMessage(error), values };

  revalidatePath("/kullanicilar");
  return { ok: randomUUID(), message: `${parsed.data.email} eklendi` };
}

export async function changeRole(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const role = memberSchema.shape.role.safeParse(values.role);
  if (!isUuid(values.user_id) || !role.success)
    return { error: "Geçersiz istek" };

  const { supabase, tenant } = await getContext();
  const { data, error } = await supabase
    .from("memberships")
    .update({ role: role.data })
    .eq("tenant_id", tenant.id)
    .eq("user_id", values.user_id)
    .select("user_id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Bu işlem için yetkiniz yok" };

  revalidatePath("/kullanicilar");
  return { ok: randomUUID(), message: "Rol güncellendi" };
}

export async function removeMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Geçersiz istek" };

  const { supabase, tenant } = await getContext();
  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("user_id", id)
    .select("user_id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Bu işlem için yetkiniz yok" };

  revalidatePath("/kullanicilar");
  return { ok: randomUUID(), message: "Çıkarıldı" };
}
