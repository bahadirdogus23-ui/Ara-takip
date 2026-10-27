"use server";

import { redirect } from "next/navigation";
import { setActiveTenantCookie } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  tenantSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

export async function createTenant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = tenantSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  // Firma + kullanıcıyı firma sahibi yapan üyelik tek işlemde oluşturulur
  const { data: tenantId, error } = await supabase.rpc("create_tenant", {
    p_name: parsed.data.name,
  });
  if (error) return { error: dbErrorMessage(error), values };

  await setActiveTenantCookie(tenantId);
  // Yeni firma: önce bir dakikalık kurulum
  redirect("/kurulum");
}
