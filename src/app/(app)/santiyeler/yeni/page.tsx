import Link from "next/link";
import { redirect } from "next/navigation";
import { canManage, getContext } from "@/lib/context";
import { SiteForm } from "../site-form";

export const metadata = { title: "Yeni şantiye" };

export default async function NewSitePage() {
  const { tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/santiyeler");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/santiyeler" className="link text-sm">
        ← Şantiyeler
      </Link>
      <h1 className="text-2xl font-bold">Yeni şantiye</h1>
      <div className="card">
        <SiteForm />
      </div>
    </div>
  );
}
