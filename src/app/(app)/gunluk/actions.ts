"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow, updateRow } from "@/lib/actions";
import { getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import {
  formValues,
  productionEditSchema,
  productionSchema,
  toFieldErrors,
  tripSchema,
  type FormState,
} from "@/lib/validation";

const PATHS = ["/gunluk", "/kayitlar", "/panel"];

function saved(message: string, keep: Record<string, string>): FormState {
  PATHS.forEach((p) => revalidatePath(p));
  // ok: bir sonraki gönderimin tekrar-gönderim anahtarı; seçili kalem/araç korunur
  return { ok: randomUUID(), message, values: keep };
}

export async function saveProduction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = productionSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const { supabase, tenant } = await getContext();
  const { error } = await supabase
    .from("production_entries")
    .insert({ ...parsed.data, tenant_id: tenant.id });

  // Aynı form daha önce ulaşmış (ör. zayıf internette tekrar gönderim): ikinci kayıt açılmaz
  if (error?.code === "23505")
    return saved("Bu kayıt zaten alınmıştı", {
      work_item_id: parsed.data.work_item_id,
    });
  if (error) return { error: dbErrorMessage(error), values };
  return saved("İmalat kaydedildi", { work_item_id: parsed.data.work_item_id });
}

export async function saveTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = tripSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const { supabase, tenant } = await getContext();
  const { error } = await supabase
    .from("trip_entries")
    .insert({ ...parsed.data, tenant_id: tenant.id });

  const keep = {
    vehicle_id: parsed.data.vehicle_id,
    route_id: parsed.data.route_id ?? "",
  };
  if (error?.code === "23505") return saved("Bu kayıt zaten alınmıştı", keep);
  if (error) return { error: dbErrorMessage(error), values };
  return saved("Sefer kaydedildi", keep);
}

export async function deleteProduction(_prev: FormState, formData: FormData) {
  return deleteRow("production_entries", formData, PATHS);
}

export async function deleteTrip(_prev: FormState, formData: FormData) {
  return deleteRow("trip_entries", formData, PATHS);
}

export async function updateProduction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = productionEditSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };
  return updateRow("production_entries", values.id, parsed.data, PATHS);
}
