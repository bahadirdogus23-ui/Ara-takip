// İnternet yokken girilen seferler telefonda (localStorage) bekler, bağlantı gelince
// sırayla gönderilir. Her kaydın requestId'si olduğu için iki kez gönderilse de
// sunucuda bir kez sayılır.
//
// Kural: telefona yazılmış hiçbir sefer sessizce silinmez.
// - Kayıt hangi firma ve kullanıcıya aitse yalnızca o oturumda gönderilir (telefonu başkası
//   kullanırsa ya da firma değiştirilirse yanlış yere yazılmaz). Çıkış yapmak kuyruğu silmez.
// - Sunucu reddederse (ör. çok eski tarih) kayıt "gönderilemeyenler" listesine taşınır;
//   kullanıcı sebebi görür, tekrar dener ya da kendisi siler.

export type QueuedTap = {
  siteId: string;
  vehicleId: string;
  routeId: string | null;
  requestId: string;
  entryDate: string; // seferin yapıldığı gün (gece yarısından sonra gönderilse de doğru güne yazılır)
  tonnage?: number | null; // kantar tonu
  at: number;
  tenantId?: string; // eski sürümde yazılmış kayıtlarda yok
  userId?: string;
};

export type RejectedTap = QueuedTap & { error: string; rejectedAt: number };

export type QueueOwner = { tenantId: string; userId: string };

export const QUEUE_KEY = "hafriyol_kuyruk";
export const REJECTED_KEY = "hafriyol_gonderilemeyen";
// Kuyruk değişince ekranlar yeniden okusun
export const QUEUE_EVENT = "hafriyol-kuyruk";
// Gönderim bitince sonucu bildirir (detail: { sent, rejected }); hangi ekran göndermiş olursa olsun
export const SENT_EVENT = "hafriyol-gonderim";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  try {
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {}
}

export const readQueue = () => read<QueuedTap>(QUEUE_KEY);
export const writeQueue = (queue: QueuedTap[]) => write(QUEUE_KEY, queue);
export const readRejected = () => read<RejectedTap>(REJECTED_KEY);
export const writeRejected = (list: RejectedTap[]) => write(REJECTED_KEY, list);

// Kayıt bu oturuma mı ait? (Eski sürümden kalan etiketsiz kayıtlar oturumdaki kullanıcıyla gönderilir.)
export const belongsTo = (t: QueuedTap, owner: QueueOwner) =>
  (!t.tenantId || t.tenantId === owner.tenantId) &&
  (!t.userId || t.userId === owner.userId);

export const mine = <T extends QueuedTap>(list: T[], owner: QueueOwner) =>
  list.filter((t) => belongsTo(t, owner));

export function enqueue(t: QueuedTap) {
  writeQueue([...readQueue(), t]);
}

type SendResult = { ok: true } | { ok: false; error: string };

let flushing = false;

// Bu oturuma ait bekleyenleri sırayla gönderir. Ağ hatasında durur (kayıt kuyrukta kalır);
// sunucu reddederse kayıt "gönderilemeyenler"e taşınır.
export async function flushQueue(
  send: (t: QueuedTap) => Promise<SendResult>,
  owner: QueueOwner,
): Promise<{ sent: number; rejected: number }> {
  let sent = 0;
  let rejected = 0;
  if (flushing) return { sent, rejected };
  flushing = true;
  try {
    for (const t of mine(readQueue(), owner)) {
      let res: SendResult;
      try {
        res = await send(t);
      } catch {
        break;
      }
      writeQueue(readQueue().filter((q) => q.requestId !== t.requestId));
      if (res.ok) sent++;
      else {
        writeRejected([
          ...readRejected(),
          { ...t, error: res.error, rejectedAt: Date.now() },
        ]);
        rejected++;
      }
    }
  } finally {
    flushing = false;
    if (sent || rejected) {
      try {
        window.dispatchEvent(
          new CustomEvent(SENT_EVENT, { detail: { sent, rejected } }),
        );
      } catch {}
    }
  }
  return { sent, rejected };
}

// Gönderilemeyen kaydı tekrar kuyruğa alır
export function retryRejected(requestId: string) {
  const list = readRejected();
  const item = list.find((r) => r.requestId === requestId);
  if (!item) return;
  const tap: Partial<RejectedTap> = { ...item };
  delete tap.error;
  delete tap.rejectedAt;
  writeRejected(list.filter((r) => r.requestId !== requestId));
  enqueue(tap as QueuedTap);
}

export function discardRejected(requestId: string) {
  writeRejected(readRejected().filter((r) => r.requestId !== requestId));
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
export function withoutLastFor(
  queue: QueuedTap[],
  siteId: string,
  vehicleId: string,
): { queue: QueuedTap[]; removed: boolean } {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].siteId === siteId && queue[i].vehicleId === vehicleId) {
      return {
        queue: [...queue.slice(0, i), ...queue.slice(i + 1)],
        removed: true,
      };
    }
  }
  return { queue, removed: false };
}
