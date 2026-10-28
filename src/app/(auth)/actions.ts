"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/errors";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

const safeNext = (value: FormDataEntryValue | null) => safePath(value);

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeNext(formData.get("sonra")));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // E-posta doğrulaması açıksa oturum hemen açılmaz
  if (!data.session) redirect("/giris?dogrula=1");
  redirect("/basla");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/giris");
}

// Şifremi unuttum: e-posta kayıtlı olsun olmasın aynı mesaj (kimin kayıtlı olduğu belli olmasın)
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  // E-posta sunucusu yavaşsa kullanıcı beklemesin: en fazla 8 sn beklenir, gönderim arka planda sürer
  const request = supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?sonra=/sifre-yenile`,
  });
  const result = await Promise.race([
    request,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
  const error = result?.error ?? null;
  if (
    error?.code === "over_email_send_rate_limit" ||
    error?.code === "over_request_rate_limit"
  ) {
    return { error: authErrorMessage(error), values };
  }
  if (error) console.error("Şifre sıfırlama e-postası:", error);
  return {
    ok: "gonderildi",
    message:
      "E-posta adresi kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunuzu kontrol edin.",
  };
}

// Yeni şifre: e-postadaki bağlantıyla açılan oturumda (ya da giriş yapmış kullanıcı) belirlenir
export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: toFieldErrors(parsed.error), values: {} };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: authErrorMessage(error) };
  // Firması olmayan kullanıcı (ör. yalnızca Hafriyol yöneticisi) başlangıç sayfasına döner
  const { count } = await supabase
    .from("memberships")
    .select("tenant_id", { count: "exact", head: true });
  redirect(count ? "/panel?sifre=1" : "/basla?sifre=1");
}
