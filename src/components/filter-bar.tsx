// Sayfa filtreleri: JavaScript gerektirmeyen düz GET formu (adres çubuğunda kalır,
// paylaşılabilir ve geri tuşuyla çalışır).
export function FilterBar({
  sites,
  siteId,
  from,
  to,
  hidden,
}: {
  sites: { id: string; name: string }[];
  siteId: string;
  from: string;
  to: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form method="get" className="card grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="col-span-2 space-y-1 sm:col-span-1">
        <label htmlFor="f-santiye" className="block text-sm font-medium">
          Şantiye
        </label>
        <select id="f-santiye" name="santiye" defaultValue={siteId} className="input">
          <option value="">Tüm şantiyeler</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="f-bas" className="block text-sm font-medium">
          Başlangıç
        </label>
        <input id="f-bas" name="bas" type="date" defaultValue={from} className="input" />
      </div>
      <div className="space-y-1">
        <label htmlFor="f-bit" className="block text-sm font-medium">
          Bitiş
        </label>
        <input id="f-bit" name="bit" type="date" defaultValue={to} className="input" />
      </div>
      <button className="btn-secondary col-span-2 sm:col-span-1">Filtrele</button>
    </form>
  );
}
