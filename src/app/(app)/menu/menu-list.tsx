"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { visibleItems, type Access } from "../nav";

export function MenuList(access: Access) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {visibleItems(access).map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-bg">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand-strong">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-5 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
