import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABELS, canManage, getContext } from "@/lib/context";
import { BottomNav, DesktopNav } from "./nav";
import { TenantSwitcher } from "./tenant-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, tenants } = await getContext();
  const access = { manager: canManage(tenant.role), owner: tenant.role === "owner" };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link href="/panel" className="text-xl font-extrabold tracking-tight">
            Hafri<span className="text-brand">yol</span>
          </Link>
          <div className="min-w-0 flex-1">
            {tenants.length > 1 ? (
              <TenantSwitcher tenants={tenants} activeId={tenant.id} />
            ) : (
              <p className="truncate text-sm font-semibold">{tenant.name}</p>
            )}
            <p className="truncate text-xs text-muted">
              {user.email} · {ROLE_LABELS[tenant.role]}
            </p>
          </div>
          <form action={signOut} className="hidden md:block">
            <button className="btn-secondary min-h-9 gap-1.5 px-3 text-sm">
              <LogOut className="size-4" aria-hidden />
              Çıkış
            </button>
          </form>
        </div>
        <DesktopNav {...access} />
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
