"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/actions";
import { dbErrorMessage } from "@/lib/errors";
import { isoDateTR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation";

// Hafriyol yönetimi: firmayı aktif eder (süreli) ya da askıya alır. Yetki veritabanında denetlenir.
export async function setPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = formData.get("id");
  const action = String(formData.get("islem") ?? "");
  if (!isUuid(id)) return { error: "Geçersiz firma" };

  let status: "active" | "suspended";
  let paidUntil: string | null = null;
  if (action === "ay" || action === "yil") {
    status = "active";
    const d = new Date(`${isoDateTR()}T00:00:00Z`);
    if (action === "ay") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    paidUntil = d.toISOString().slice(0, 10);
  } else if (action === "suresiz") status = "active";
  else if (action === "askiya") status = "suspended";
  else return { error: "Geçersiz işlem" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan", {
    p_tenant: id,
    p_status: status,
    p_paid_until: paidUntil,
  });
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/yonetim");
  revalidatePath(`/yonetim/firma/${id}`);
  return {
    ok: `${id}${action}`,
    message: status === "active" ? "Firma aktif edildi" : "Firma askıya alındı",
  };
}
