import { describe, expect, it } from "vitest";
import { fuelCheck, routeLimit, suspiciousTrips } from "@/lib/field-checks";

describe("mazot normu", () => {
  it("saatlik tüketimi hesaplar, %20 toleransı aşınca uyarır", () => {
    expect(fuelCheck(10, 180, 15)).toEqual({ lph: 18, over: false }); // 18 = 15 × 1,2 sınırda
    expect(fuelCheck(10, 181, 15)).toEqual({ lph: 18.1, over: true });
    expect(fuelCheck(8, 150, null)).toEqual({ lph: 18.8, over: false }); // norm yoksa uyarı yok
    expect(fuelCheck(null, 150, 15)).toEqual({ lph: null, over: false });
  });
});

describe("güzergâh sefer sınırı", () => {
  it("girilen çevrim süresini kullanır", () => {
    // 11 saat = 660 dk ÷ 45 dk = 14 sefer
    expect(routeLimit({ cycle_minutes: 45, distance_km: null })).toEqual({
      cycleMinutes: 45,
      estimated: false,
      maxTrips: 14,
    });
  });

  it("çevrim yoksa mesafeden tahmin eder", () => {
    // 5 km: 10 km gidiş-dönüş ÷ 30 km/sa = 20 dk + 15 dk = 35 dk → 660 ÷ 35 = 18
    expect(routeLimit({ cycle_minutes: null, distance_km: 5 })).toEqual({
      cycleMinutes: 35,
      estimated: true,
      maxTrips: 18,
    });
    expect(routeLimit({ cycle_minutes: null, distance_km: null })).toBeNull();
  });

  it("aynı araç ve güzergâhta günlük sınırı aşan seferleri bulur", () => {
    const routes = [
      { id: "r1", cycle_minutes: 60, distance_km: null }, // en fazla 11
      { id: "r2", cycle_minutes: null, distance_km: null }, // sınır bilinmiyor
    ];
    const trips = [
      { vehicle_id: "v1", route_id: "r1", trip_count: 8 },
      { vehicle_id: "v1", route_id: "r1", trip_count: 4 }, // toplam 12 > 11
      { vehicle_id: "v2", route_id: "r1", trip_count: 11 }, // sınırda, normal
      { vehicle_id: "v1", route_id: "r2", trip_count: 40 }, // bilinmeyen sınır
      { vehicle_id: "v3", route_id: null, trip_count: 99 }, // güzergâhsız
    ];
    expect(suspiciousTrips(trips, routes)).toEqual([
      {
        vehicleId: "v1",
        routeId: "r1",
        trips: 12,
        maxTrips: 11,
        estimated: false,
      },
    ]);
  });
});

import { machineLogSchema, toFieldErrors } from "@/lib/validation";

describe("makine kaydı doğrulama", () => {
  const base = {
    site_id: "11111111-1111-4111-8111-111111111111",
    vehicle_id: "22222222-2222-4222-8222-222222222222",
    log_date: "2026-10-25",
    operator: "",
    note: "",
    client_request_id: "33333333-3333-4333-8333-333333333333",
  };

  it("saat ve mazotu Türkçe sayı olarak alır", () => {
    expect(
      machineLogSchema.parse({ ...base, hours: "9,5", fuel_liters: "180" }),
    ).toMatchObject({ hours: 9.5, fuel_liters: 180 });
  });

  it("ikisi de boşsa veya saat 24'ü aşarsa uyarır", () => {
    expect(
      toFieldErrors(
        machineLogSchema.safeParse({ ...base, hours: "", fuel_liters: "" })
          .error!,
      ).hours,
    ).toBe("Çalışma saati veya mazot girin");
    expect(
      toFieldErrors(
        machineLogSchema.safeParse({ ...base, hours: "25", fuel_liters: "" })
          .error!,
      ).hours,
    ).toBe("Çalışma saati çok büyük");
  });
});

import { guessVehicleKind } from "@/lib/field-checks";

describe("araç türü", () => {
  it("iş makinelerini kamyonlardan ayırır", () => {
    for (const t of [
      "Ekskavatör",
      "Paletli ekskavatör",
      "Kazıcı yükleyici (beko)",
      "Greyder",
      "Silindir",
      "Lastikli loder",
    ]) {
      expect(guessVehicleKind(t)).toBe("is_makinesi");
    }
    expect(guessVehicleKind("JCB 3CX")).toBe("is_makinesi");
    for (const t of ["Kamyon", "Damperli kamyon", "Çekici", "Tanker"])
      expect(guessVehicleKind(t)).toBe("kamyon");
    expect(guessVehicleKind("Arazöz")).toBe("diger");
  });
});
