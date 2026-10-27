"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteRow } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import {
  expenseSchema,
  formValues,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

export async function saveExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { supabase, tenant } = await getContext();
  if (!canManage(tenant.role))
    return { error: "Gider girme yetkiniz yok", values };

  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const { error } = await supabase
    .from("expenses")
    .insert({ ...parsed.data, tenant_id: tenant.id });
  // İş kalemi seçilen şantiyeye ait değilse veritabanı reddeder (bileşik yabancı anahtar)
  if (error?.code === "23503")
    return {
      fieldErrors: { work_item_id: "Bu iş kalemi seçilen şantiyeye ait değil" },
      values,
    };
  const duplicate = error?.code === "23505";
  if (error && !duplicate) return { error: dbErrorMessage(error), values };

  revalidatePath("/giderler");
  // Şantiye ve tarih sonraki gider için kalır
  return {
    ok: randomUUID(),
    message: duplicate ? "Bu gider zaten kaydedilmişti" : "Gider kaydedildi",
    values: {
      site_id: parsed.data.site_id,
      expense_date: parsed.data.expense_date,
      vat_rate: String(parsed.data.vat_rate),
    },
  };
}

export async function deleteExpense(_prev: FormState, formData: FormData) {
  return deleteRow("expenses", formData, ["/giderler"]);
}
