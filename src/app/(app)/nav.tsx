"use client";

import {
  BarChart3,
  Building2,
  Camera,
  ClipboardList,
  Fuel,
  HandCoins,
  HardHat,
  Home,
  Menu,
  Plus,
  Receipt,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
  ownerOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Bugün", icon: Home },
  { href: "/sefer", label: "Sefer sayacı", icon: Truck },
  { href: "/gunluk", label: "Kayıt gir", icon: Plus },
  { href: "/makine", label: "Makine ve mazot", icon: Fuel },
  { href: "/fotograflar", label: "Fotoğraflar", icon: Camera },
  { href: "/kayitlar", label: "Kayıtlar", icon: ClipboardList },
  { href: "/giderler", label: "Giderler", icon: Receipt, managerOnly: true },
  { href: "/rapor", label: "Rapor", icon: BarChart3, managerOnly: true },
  {
    href: "/hakedis",
    label: "Taşeron hakedişi",
    icon: HandCoins,
    managerOnly: true,
  },
  { href: "/santiyeler", label: "Şantiyeler", icon: Building2 },
  { href: "/araclar", label: "Araçlar", icon: HardHat },
  {
    href: "/kullanicilar",
    label: "Kullanıcılar",
    icon: Users,
    ownerOnly: true,
  },
];

export type Access = { manager: boolean; owner: boolean };

export const visibleItems = ({ manager, owner }: Access) =>
  NAV_ITEMS.filter(
    (l) => (manager || !l.managerOnly) && (owner || !l.ownerOnly),
  );

const isActive = (path: string, href: string) =>
  path === href || path.startsWith(`${href}/`);

// Bilgisayarda üstte yatay menü
export function DesktopNav(access: Access) {
  const path = usePathname();
  return (
    <nav className="mx-auto hidden max-w-5xl gap-1 px-2 md:flex">
      {visibleItems(access).map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              active
                ? "border-brand text-fg"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Telefonda altta, başparmakla ulaşılan sekme çubuğu; ortada büyük "kayıt gir" düğmesi
const BOTTOM: {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}[] = [
  { href: "/panel", label: "Bugün", icon: Home },
  { href: "/sefer", label: "Sefer", icon: Truck },
  { href: "/gunluk", label: "Kayıt gir", icon: Plus, primary: true },
  { href: "/kayitlar", label: "Kayıtlar", icon: ClipboardList },
  { href: "/menu", label: "Menü", icon: Menu },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Ana menü"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {BOTTOM.map(({ href, label, icon: Icon, primary }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-brand-strong" : "text-muted"
                }`}
              >
                {primary ? (
                  <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-bg dark:text-black">
                    <Icon className="size-7" aria-hidden strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon
                    className="size-6"
                    aria-hidden
                    strokeWidth={active ? 2.5 : 2}
                  />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
