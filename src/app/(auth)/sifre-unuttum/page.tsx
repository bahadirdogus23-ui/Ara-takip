import Link from "next/link";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = { title: "Şifremi unuttum" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-bold">Şifremi unuttum</h1>
      <p className="mb-4 text-sm text-muted">
        E-posta adresinizi yazın; şifrenizi yenilemeniz için bir bağlantı
        gönderelim.
      </p>
      <ResetRequestForm />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/giris" className="link">
          Girişe dön
        </Link>
      </p>
    </>
  );
}
