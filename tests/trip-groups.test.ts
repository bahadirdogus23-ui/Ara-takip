import { describe, expect, it } from "vitest";
import { groupTrips, type TripRow } from "@/lib/trip-groups";

const row = (id: string, over: Partial<TripRow> = {}): TripRow => ({
  id,
  vehicle_id: "v1",
  route_id: "r1",
  entry_date: "2026-10-26",
  trip_count: 1,
  tonnage: null,
  note: null,
  created_by: "u1",
  ...over,
});

describe("sefer listesi gruplama", () => {
  it("aynı gün, araç ve güzergâhı tek satırda toplar; tonu ayrı sayar", () => {
    const g = groupTrips(
      [row("c", { tonnage: 24.5 }), row("b"), row("a", { tonnage: 25 }), row("d", { route_id: null }), row("e", { vehicle_id: "v2" })],
      () => true,
    );
    expect(g.map((x) => [x.vehicleId, x.routeId, x.trips, x.ton, x.untonned, x.lastDeletableId])).toEqual([
      ["v1", "r1", 3, 49.5, 1, "c"],
      ["v1", null, 1, 0, 1, "d"],
      ["v2", "r1", 1, 0, 1, "e"],
    ]);
  });

  it("silinebilecek son kayıt kullanıcının kendi kaydıdır", () => {
    const g = groupTrips([row("b", { created_by: "baskasi" }), row("a", { created_by: "ben" })], (by) => by === "ben");
    expect(g[0].lastDeletableId).toBe("a");
  });
});
