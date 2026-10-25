"use client";

import { MapPin } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

// Şantiye seçimi: adres çubuğuna yazılır ve tarayıcıda hatırlanır
export function SitePicker({ sites, siteId }: { sites: { id: string; name: string }[]; siteId: string }) {
  const router = useRouter();
  const path = usePathname();
  if (sites.length < 2) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <MapPin className="size-4" aria-hidden />
        {sites[0]?.name}
      </p>
    );
  }
  return (
    <label className="flex items-center gap-2">
      <MapPin className="size-5 shrink-0 text-muted" aria-hidden />
      <span className="sr-only">Şantiye</span>
      <select
        value={siteId}
        onChange={(e) => {
          document.cookie = `hafriyol_santiye=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.push(`${path}?santiye=${e.target.value}`);
        }}
        className="input min-h-11 font-semibold"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
