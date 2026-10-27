"use client";

import { useRouter } from "next/navigation";

// Şantiye ve tarih değişince sayfa o güne ait formlarla yeniden yüklenir
export function SiteDatePicker({
  sites,
  siteId,
  date,
}: {
  sites: { id: string; name: string }[];
  siteId: string;
  date: string;
}) {
  const router = useRouter();
  const go = (site: string, day: string) => {
    document.cookie = `hafriyol_santiye=${site}; path=/; max-age=31536000; samesite=lax`;
    router.push(`/gunluk?santiye=${site}&tarih=${day}`);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <div className="space-y-1">
        <label htmlFor="santiye" className="block text-sm font-medium">
          Şantiye
        </label>
        <select
          id="santiye"
          value={siteId}
          onChange={(e) => go(e.target.value, date)}
          className="input"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="tarih" className="block text-sm font-medium">
          Tarih
        </label>
        <input
          id="tarih"
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(siteId, e.target.value)}
          className="input"
        />
      </div>
    </div>
  );
}
