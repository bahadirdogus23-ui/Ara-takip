import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Sayfa bulunamadı</h1>
      <p className="mt-2 text-muted">Aradığınız kayıt yok ya da görme yetkiniz bulunmuyor.</p>
      <Link href="/panel" className="btn-primary mt-6">
        Panele dön
      </Link>
    </main>
  );
}
