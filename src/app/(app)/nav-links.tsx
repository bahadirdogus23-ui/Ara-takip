"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/santiyeler", label: "Şantiyeler" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              active ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
