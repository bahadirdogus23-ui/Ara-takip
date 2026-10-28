import { Building2, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const metadata = { title: "Başlayın" };

// Kayıttan sonra: davet koduyla bir firmaya katıl ya da yeni firma kur
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ kod?: string; sifre?: string }>;
}) {
  const { kod, sifre } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const [{ count }, { data: admin }] = await Promise.all([
    supabase
      .from("memberships")
      .select("tenant_id", { count: "exact", head: true }),
    supabase.rpc("am_platform_admin"),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="text-3xl font-extrabold tracking-tight">
          Hafri<span className="text-brand">yol</span>
        </p>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>
      {sifre && (
        <p
          role="status"
          className="rounded-md bg-green-50 p-3 text-sm text-green-800"
        >
          Şifreniz değiştirildi.
        </p>
      )}

      {admin && (
        <Link href="/yonetim" className="btn-primary w-full gap-2">
          <ShieldCheck className="size-5" aria-hidden /> Hafriyol yönetim ekranı
        </Link>
      )}

      <section className="card space-y-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <KeyRound className="size-5 text-brand" aria-hidden /> Davet kodum var
        </h1>
        <p className="text-sm text-muted">
          Çalıştığınız firmanın verdiği kodu girin; size verilen yetkiyle hemen
          başlarsınız.
        </p>
        <JoinForm code={kod?.slice(0, 12)} />
      </section>

      <section className="card space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Building2 className="size-5 text-brand" aria-hidden /> Firmamı kurmak
          istiyorum
        </h2>
        <p className="text-sm text-muted">
          Firma sahibi ya da yetkilisiyseniz firmanızı kurun, aboneliği
          başlatın.
        </p>
        <Link href="/firma-olustur" className="btn-secondary w-full">
          Yeni firma kur
        </Link>
      </section>

      {count ? (
        <Link href="/panel" className="link text-center text-sm">
          Firmalarıma dön
        </Link>
      ) : null}
      <Link href="/sifre-yenile" className="link text-center text-sm">
        Şifremi değiştir
      </Link>
      <SignOutButton className="btn-secondary w-full gap-2" label="Çıkış yap" />
    </main>
  );
}
