"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import {
  formValues,
  inviteSchema,
  memberSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

// Davet kodu: sahip her rol, yönetici yalnızca saha personeli (veritabanı da denetler)
export async function createInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role))
    return { error: "Davet kodu oluşturma yetkiniz yok" };
  const { data: code, error } = await supabase.rpc("create_invite", {
    p_tenant: tenant.id,
    p_role: parsed.data.role,
    p_label: parsed.data.label,
    p_days: parsed.data.days,
    p_max_uses: parsed.data.max_uses,
  });
  if (error) return { error: dbErrorMessage(error), values };

  revalidatePath("/kullanicilar");
  return { ok: code, message: code, values: { role: parsed.data.role } };
}

export async function revokeInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("id") ?? "");
  if (!/^[A-Z2-9]{8}$/.test(code)) return { error: "Geçersiz kod" };
  const { supabase, tenant } = await getContext();
  const { data, error } = await supabase
    .from("invite_codes")
    .update({ revoked: true })
    .eq("code", code)
    .eq("tenant_id", tenant.id)
    .select("code");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Bu kodu iptal etme yetkiniz yok" };
  revalidatePath("/kullanicilar");
  return { ok: code, message: "Kod iptal edildi" };
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
  if (!data?.length)
    return { error: "Rolü yalnızca firma sahibi değiştirebilir" };

  revalidatePath("/kullanicilar");
  return { ok: randomUUID(), message: "Rol güncellendi" };
}

// Sahip herkesi, yönetici yalnızca saha personelini çıkarabilir (RLS)
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
  if (!data?.length) return { error: "Bu kişiyi çıkarma yetkiniz yok" };

  revalidatePath("/kullanicilar");
  return { ok: randomUUID(), message: "Çıkarıldı" };
}
