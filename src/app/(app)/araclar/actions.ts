"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow, isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { guessVehicleKind } from "@/lib/field-checks";
import { isoDateTR } from "@/lib/format";
import { saveVehicleRates, validFrom } from "@/lib/prices";
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
  // Kira ücretleri ayrı tabloda (yalnızca sahibi/yönetici görür)
  const { hourly_rate, daily_rate, price_from, kind, ...vehicle } = parsed.data;
  const from = validFrom(price_from, isoDateTR());
  if (!from)
    return {
      fieldErrors: {
        price_from: "Ücretin geçerlilik başlangıcı ileri bir tarih olamaz",
      },
      values,
    };
  const row = {
    ...vehicle,
    kind: kind ?? guessVehicleKind(vehicle.vehicle_type),
    tenant_id: tenant.id,
  };
  const { data, error } = editId
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
  const rates = await saveVehicleRates(supabase, {
    vehicle_id: data.id,
    tenant_id: tenant.id,
    hourly_rate,
    daily_rate,
    valid_from: from,
  });
  if (rates.error) return { error: dbErrorMessage(rates.error), values };

  // Şantiye ataması: yalnızca formda gösterilen (devam eden) şantiyeler eşitlenir
  const { data: sites } = await supabase
    .from("sites")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("status", "active");
  const shown = (sites ?? []).map((x) => x.id);
  const picked = shown.filter((id) => formData.get(`site_${id}`) === "on");
  const dropped = shown.filter((id) => !picked.includes(id));
  if (dropped.length) {
    const { error: e } = await supabase
      .from("site_vehicles")
      .delete()
      .eq("vehicle_id", data.id)
      .eq("tenant_id", tenant.id)
      .in("site_id", dropped);
    if (e) return { error: dbErrorMessage(e), values };
  }
  if (picked.length) {
    const { error: e } = await supabase.from("site_vehicles").upsert(
      picked.map((site_id) => ({
        tenant_id: tenant.id,
        site_id,
        vehicle_id: data.id,
      })),
      { onConflict: "site_id,vehicle_id", ignoreDuplicates: true },
    );
    if (e) return { error: dbErrorMessage(e), values };
  }

  revalidatePath("/araclar");
  revalidatePath("/sefer");
  return {
    ok: randomUUID(),
    message: "Kaydedildi",
    values: editId ? values : undefined,
  };
}

export async function deleteVehicle(_prev: FormState, formData: FormData) {
  return deleteRow("vehicles", formData, ["/araclar"]);
}
