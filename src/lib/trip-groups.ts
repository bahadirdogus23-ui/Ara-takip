// Sefer sayacı her dokunuşta ayrı kayıt açar; listelerde bunlar araç + güzergâh (+ gün)
// bazında toplanır. Kayıtlar en yeniden eskiye sıralı gelmelidir: "son sefer" ilk bulunan.

export type TripRow = {
  id: string;
  vehicle_id: string;
  route_id: string | null;
  entry_date: string;
  trip_count: number;
  tonnage: number | null;
  note: string | null;
  created_by: string;
};

export type TripGroup = {
  key: string;
  vehicleId: string;
  routeId: string | null;
  date: string;
  trips: number;
  ton: number; // girilen kantar tonu
  untonned: number; // tonu girilmemiş sefer
  notes: string[];
  lastDeletableId: string | null; // kullanıcının silebileceği en son kayıt
};

export function groupTrips(rows: TripRow[], canDelete: (createdBy: string) => boolean): TripGroup[] {
  const groups = new Map<string, TripGroup>();
  for (const t of rows) {
    const key = `${t.entry_date}|${t.vehicle_id}|${t.route_id ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, vehicleId: t.vehicle_id, routeId: t.route_id, date: t.entry_date, trips: 0, ton: 0, untonned: 0, notes: [], lastDeletableId: null };
      groups.set(key, g);
    }
    g.trips += t.trip_count;
    if (t.tonnage !== null) g.ton = Math.round((g.ton + Number(t.tonnage)) * 1000) / 1000;
    else g.untonned += t.trip_count;
    if (t.note) g.notes.push(t.note);
    if (!g.lastDeletableId && canDelete(t.created_by)) g.lastDeletableId = t.id;
  }
  return [...groups.values()];
}
