import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Kayıt ol" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Hesap oluştur</h1>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted">
        Zaten hesabınız var mı?{" "}
        <Link href="/giris" className="link">
          Giriş yapın
        </Link>
      </p>
    </>
  );
}
