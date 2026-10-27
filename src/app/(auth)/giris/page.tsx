import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Giriş" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sonra?: string; dogrula?: string; hata?: string }>;
}) {
  const { sonra, dogrula, hata } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Giriş yap</h1>
      {dogrula && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Hesabınız oluşturuldu. E-posta adresinize gelen bağlantıya tıklayıp
          ardından giriş yapın.
        </p>
      )}
      {hata && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Doğrulama bağlantısı geçersiz veya süresi dolmuş.
        </p>
      )}
      <SignInForm next={sonra} />
      <p className="mt-4 text-center text-sm">
        <Link href="/sifre-unuttum" className="link">
          Şifremi unuttum
        </Link>
      </p>
      <p className="mt-6 text-center text-sm text-muted">
        Hesabınız yok mu?{" "}
        <Link href="/kayit" className="link">
          Kayıt olun
        </Link>
      </p>
    </>
  );
}
