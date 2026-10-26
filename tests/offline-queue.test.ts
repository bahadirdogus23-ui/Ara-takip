import { beforeEach, describe, expect, it } from "vitest";
import { pendingByVehicle, QUEUE_KEY, readQueue, withoutLastFor, writeQueue, type QueuedTap } from "@/lib/offline-queue";

const tap = (vehicleId: string, requestId: string, entryDate = "2026-10-25", siteId = "s1"): QueuedTap => ({
  siteId,
  vehicleId,
  routeId: null,
  requestId,
  entryDate,
  at: 0,
});

// Testte localStorage yok: basit bir taklit
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe("çevrimdışı sefer kuyruğu", () => {
  it("yazar ve okur; bozuk veride boş döner", () => {
    writeQueue([tap("v1", "a")]);
    expect(readQueue()).toHaveLength(1);
    store.set(QUEUE_KEY, "{bozuk");
    expect(readQueue()).toEqual([]);
  });

  it("araç başına bekleyenleri yalnızca o şantiye ve gün için sayar", () => {
    const q = [
      { ...tap("v1", "a"), tonnage: 24.5 },
      tap("v1", "b"),
      tap("v2", "c"),
      tap("v1", "d", "2026-10-24"),
      tap("v1", "e", "2026-10-25", "s2"),
    ];
    expect([...pendingByVehicle(q, "s1", "2026-10-25")]).toEqual([
      ["v1", { trips: 2, ton: 24.5, untonned: 1 }],
      ["v2", { trips: 1, ton: 0, untonned: 1 }],
    ]);
  });

  it("geri alınca o aracın en son seferini çıkarır", () => {
    const q = [tap("v1", "a"), tap("v2", "b"), tap("v1", "c")];
    const r = withoutLastFor(q, "s1", "v1");
    expect(r.removed).toBe(true);
    expect(r.queue.map((t) => t.requestId)).toEqual(["a", "b"]);
    expect(withoutLastFor([], "s1", "v1").removed).toBe(false);
  });
});
