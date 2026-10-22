"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, siteSchema, toFieldErrors, type FormState } from "@/lib/validation";

export async function saveSite(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const { supabase, tenant } = await getContext();

  // Arayüzde düğme gizli olsa da sunucuda tekrar kontrol edilir (RLS de engeller)
  if (!canManage(tenant.role)) return { error: "Şantiye ekleme/düzenleme yetkiniz yok", values };

  const parsed = siteSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const id = values.id;
  const query = id
    ? supabase.from("sites").update(parsed.data).eq("id", id).eq("tenant_id", tenant.id).select("id").single()
    : supabase.from("sites").insert({ ...parsed.data, tenant_id: tenant.id }).select("id").single();

  const { data, error } = await query;
  if (error) return { error: dbErrorMessage(error), values };

  revalidatePath("/santiyeler");
  revalidatePath("/panel");
  redirect(`/santiyeler/${data.id}?kaydedildi=1`);
}
