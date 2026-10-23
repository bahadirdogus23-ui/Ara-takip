import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABELS, canManage, getContext } from "@/lib/context";
import { NavLinks } from "./nav-links";
import { TenantSwitcher } from "./tenant-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, tenants } = await getContext();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
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
          <form action={signOut}>
            <button className="btn-secondary min-h-9 px-3 text-sm">Çıkış</button>
          </form>
        </div>
        <NavLinks manager={canManage(tenant.role)} />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
