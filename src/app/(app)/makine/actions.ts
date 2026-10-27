"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow } from "@/lib/actions";
import { getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import {
  formValues,
  machineLogSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

const PATHS = ["/makine", "/panel"];

export async function saveMachineLog(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = machineLogSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const { supabase, tenant } = await getContext();
  const { error } = await supabase
    .from("machine_logs")
    .insert({ ...parsed.data, tenant_id: tenant.id });
  if (error && error.code !== "23505")
    return { error: dbErrorMessage(error), values };

  PATHS.forEach((p) => revalidatePath(p));
  // Operatör adı sonraki kayıt için kalır (aynı kişi birden çok makine girebilir)
  return {
    ok: randomUUID(),
    message: error ? "Bu kayıt zaten alınmıştı" : "Makine kaydı alındı",
    values: { operator: values.operator ?? "" },
  };
}

export async function deleteMachineLog(_prev: FormState, formData: FormData) {
  return deleteRow("machine_logs", formData, PATHS);
}
