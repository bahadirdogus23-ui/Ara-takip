"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { formValues, signInSchema, signUpSchema, toFieldErrors, type FormState } from "@/lib/validation";

// Yalnızca uygulama içi yollara yönlendir (açık yönlendirme açığını önler)
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/panel";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeNext(formData.get("sonra")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) return { error: authErrorMessage(error), values };

  // E-posta doğrulaması açıksa oturum hemen açılmaz
  if (!data.session) redirect("/giris?dogrula=1");
  redirect("/firma-olustur");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/giris");
}
