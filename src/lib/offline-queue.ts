// İnternet yokken girilen seferler telefonda (localStorage) bekler, bağlantı gelince
// sırayla gönderilir. Her kaydın requestId'si olduğu için iki kez gönderilse de
// sunucuda bir kez sayılır.

export type QueuedTap = {
  siteId: string;
  vehicleId: string;
  routeId: string | null;
  requestId: string;
  entryDate: string; // seferin yapıldığı gün (gece yarısından sonra gönderilse de doğru güne yazılır)
  tonnage?: number | null; // kantar tonu
  at: number;
};

export const QUEUE_KEY = "hafriyol_kuyruk";

export function readQueue(): QueuedTap[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(queue: QueuedTap[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

// Belirli şantiye ve gün için araç başına bekleyen sefer sayısı ve kantar tonu
export function pendingByVehicle(
  queue: QueuedTap[],
  siteId: string,
  date: string,
): Map<string, { trips: number; ton: number; untonned: number }> {
  const m = new Map<string, { trips: number; ton: number; untonned: number }>();
  for (const t of queue) {
    if (t.siteId !== siteId || t.entryDate !== date) continue;
    const cur = m.get(t.vehicleId) ?? { trips: 0, ton: 0, untonned: 0 };
    cur.trips++;
    if (t.tonnage) cur.ton += t.tonnage;
    else cur.untonned++;
    m.set(t.vehicleId, cur);
  }
  return m;
}

// Geri al: bu araç için kuyruktaki en son seferi çıkarır
export function withoutLastFor(queue: QueuedTap[], siteId: string, vehicleId: string): { queue: QueuedTap[]; removed: boolean } {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].siteId === siteId && queue[i].vehicleId === vehicleId) {
      return { queue: [...queue.slice(0, i), ...queue.slice(i + 1)], removed: true };
    }
  }
  return { queue, removed: false };
}
