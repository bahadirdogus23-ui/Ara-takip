import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Yeni şifre" };

// E-postadaki bağlantı /auth/callback üzerinden oturum açıp buraya getirir
export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?hata=1");
  return (
    <>
      <h1 className="mb-2 text-xl font-bold">Yeni şifre</h1>
      <p className="mb-4 text-sm text-muted">
        {user.email} için yeni şifrenizi belirleyin.
      </p>
      <NewPasswordForm />
    </>
  );
}
