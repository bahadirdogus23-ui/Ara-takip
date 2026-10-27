"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { formValues, type FormState } from "@/lib/validation";

// Firma sahibi "ödemeyi yaptım" der; Hafriyol yönetim ekranında görünür
export async function notifyPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const { supabase, tenant } = await getTenantContext();
  if (tenant.role !== "owner")
    return { error: "Ödeme bildirimini firma sahibi yapar", values };
  const note = (values.note ?? "").trim().slice(0, 300);
  const { error } = await supabase.rpc("notify_payment", {
    p_tenant: tenant.id,
    p_note: note,
  });
  if (error) return { error: dbErrorMessage(error), values };
  revalidatePath("/odeme");
  return {
    ok: "bildirildi",
    message:
      "Bildiriminiz alındı. Ödeme onaylanınca firmanız açılır ve firma sahibi olarak başlarsınız.",
  };
}
