"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow, isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import {
  formValues,
  toFieldErrors,
  vehicleSchema,
  type FormState,
} from "@/lib/validation";

export async function saveVehicle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role))
    return { error: "Araç ekleme/düzenleme yetkiniz yok", values };

  const parsed = vehicleSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const editId = isUuid(values.id) ? values.id : null;
  const row = { ...parsed.data, tenant_id: tenant.id };
  const { error } = editId
    ? await supabase
        .from("vehicles")
        .update(row)
        .eq("id", editId)
        .eq("tenant_id", tenant.id)
        .select("id")
        .single()
    : await supabase.from("vehicles").insert(row).select("id").single();

  if (error?.code === "23505")
    return {
      fieldErrors: { plate: `${parsed.data.plate} zaten kayıtlı` },
      values,
    };
  if (error) return { error: dbErrorMessage(error), values };

  revalidatePath("/araclar");
  return {
    ok: randomUUID(),
    message: "Kaydedildi",
    values: editId ? values : undefined,
  };
}

export async function deleteVehicle(_prev: FormState, formData: FormData) {
  return deleteRow("vehicles", formData, ["/araclar"]);
}
