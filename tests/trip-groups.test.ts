import { describe, expect, it } from "vitest";
import type { TripDay } from "@/lib/summaries";
import { deleteLabels, tripGroups } from "@/lib/trip-groups";

const day = (over: Partial<TripDay> = {}): TripDay => ({
  site_id: "s1",
  vehicle_id: "v1",
  route_id: "r1",
  entry_date: "2026-10-26",
  trips: 3,
  tonnage: 49.5,
  untonned_trips: 1,
  last_at: "2026-10-26T10:00:00Z",
  last_id: "son",
  last_count: 1,
  my_last_id: "benim",
  my_last_count: 12,
  notes: [],
  ...over,
});

describe("sefer listesi gruplama", () => {
  it("veritabanında toplanmış satırı gösterime çevirir", () => {
    const [g] = tripGroups([day()], true);
    expect([
      g.trips,
      g.ton,
      g.untonned,
      g.lastDeletableId,
      g.lastCount,
    ]).toEqual([3, 49.5, 1, "son", 1]);
  });

  it("saha personeli yalnızca kendi son kaydını silebilir", () => {
    const [g] = tripGroups([day()], false);
    expect([g.lastDeletableId, g.lastCount]).toEqual(["benim", 12]);
    expect(
      tripGroups([day({ my_last_id: null, my_last_count: null })], false)[0]
        .lastDeletableId,
    ).toBeNull();
  });

  it("çok seferlik kaydı silerken sayıyı söyler", () => {
    expect(deleteLabels(12).label).toBe("Son kaydı sil (12 sefer)");
    expect(deleteLabels(12).confirmText).toContain("12 sefer");
    expect(deleteLabels(1).label).toBe("Son seferi sil");
  });
});
