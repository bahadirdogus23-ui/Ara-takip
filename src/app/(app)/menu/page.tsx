import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { canManage, getContext } from "@/lib/context";
import { MenuList } from "./menu-list";

export const metadata = { title: "Menü" };

export default async function MenuPage() {
  const { tenant } = await getContext();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Menü</h1>
      <MenuList manager={canManage(tenant.role)} owner={tenant.role === "owner"} />
      <Link href="/firma-olustur" className="card flex items-center justify-between py-4 text-sm font-medium">
        Başka bir firma ekle
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
      <form action={signOut}>
        <button className="btn-secondary w-full gap-2 text-red-700 dark:text-red-400">
          <LogOut className="size-5" aria-hidden />
          Çıkış yap
        </button>
      </form>
    </div>
  );
}
