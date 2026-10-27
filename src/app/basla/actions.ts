"use server";

import { redirect } from "next/navigation";
import { setActiveTenantCookie } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  inviteCodeSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

// Davet koduyla firmaya katılma: kodun rolüyle üye olunur
export async function joinWithCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = inviteCodeSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data: tenantId, error } = await supabase.rpc("join_with_code", {
    p_code: parsed.data.code,
  });
  if (error) return { fieldErrors: { code: dbErrorMessage(error) }, values };

  await setActiveTenantCookie(tenantId);
  redirect("/panel?katildi=1");
}
