import type { TripDay } from "@/lib/summaries";

// Sefer sayacı her dokunuşta ayrı kayıt açar; listelerde bunlar şantiye + araç + güzergâh + gün
// bazında tek satır gösterilir. Toplama veritabanında yapılır (trip_day_summary).

export type TripGroup = {
  key: string;
  siteId: string;
  vehicleId: string;
  routeId: string | null;
  date: string;
  trips: number;
  ton: number; // girilen kantar tonu
  untonned: number; // tonu girilmemiş sefer
  notes: string[];
  lastDeletableId: string | null; // kullanıcının silebileceği en son kayıt
  lastCount: number; // o kayıttaki sefer sayısı (elle girilen kayıt birden çok sefer olabilir)
};

export function tripGroups(rows: TripDay[], manager: boolean): TripGroup[] {
  return rows.map((r) => ({
    key: `${r.entry_date}|${r.site_id}|${r.vehicle_id}|${r.route_id ?? ""}`,
    siteId: r.site_id,
    vehicleId: r.vehicle_id,
    routeId: r.route_id,
    date: r.entry_date,
    trips: Number(r.trips),
    ton: Math.round(Number(r.tonnage) * 1000) / 1000,
    untonned: Number(r.untonned_trips),
    notes: r.notes ?? [],
    lastDeletableId: manager ? r.last_id : r.my_last_id,
    lastCount: Number((manager ? r.last_count : r.my_last_count) ?? 1),
  }));
}

// Silme düğmesinin metni: tek sefer mi, birden çok seferlik kayıt mı açıkça söylenir
export function deleteLabels(lastCount: number): {
  label: string;
  confirmText: string;
} {
  return lastCount > 1
    ? {
        label: `Son kaydı sil (${lastCount} sefer)`,
        confirmText: `Bu araçtaki son kayıt silinecek: ${lastCount} sefer. Emin misiniz?`,
      }
    : {
        label: "Son seferi sil",
        confirmText: "Bu araçtaki son sefer silinsin mi?",
      };
}
