import { describe, expect, it } from "vitest";
import { parseVehicleLines, WORK_ITEM_TEMPLATES } from "@/lib/setup";
import { UNITS } from "@/lib/validation";

describe("hızlı kurulum: araç listesi", () => {
  it("farklı yazımları ayrıştırır, varsayılan tür kamyon", () => {
    const { vehicles, errors } = parseVehicleLines(
      "06abc123\n34-şğ-1234, Damperli kamyon, 25\n\nEKS-01; Ekskavatör\n44 ABC 07\t Kamyon\t 18,5 ton",
    );
    expect(errors).toEqual([]);
    expect(vehicles).toEqual([
      {
        plate: "06 ABC 123",
        vehicle_type: "Kamyon",
        capacity_ton: null,
        ownership: "own",
        daily_rate: null,
      },
      {
        plate: "34 ŞĞ 1234",
        vehicle_type: "Damperli kamyon",
        capacity_ton: 25,
        ownership: "own",
        daily_rate: null,
      },
      {
        plate: "EKS-01",
        vehicle_type: "Ekskavatör",
        capacity_ton: null,
        ownership: "own",
        daily_rate: null,
      },
      {
        plate: "44 ABC 07",
        vehicle_type: "Kamyon",
        capacity_ton: 18.5,
        ownership: "own",
        daily_rate: null,
      },
    ]);
  });

  it("aynı plakayı bir kez alır, hatalı kapasiteyi satır numarasıyla bildirir", () => {
    const { vehicles, errors } = parseVehicleLines(
      "06 ABC 123\n06abc123\n35 XY 99, Kamyon, sıfır",
    );
    expect(vehicles).toHaveLength(1);
    expect(errors).toEqual(["3. satır: kapasite geçersiz"]);
  });

  it("son sütunda kiralık/taşeron ve günlük kirayı okur", () => {
    const { vehicles, errors } = parseVehicleLines(
      "06 KR 501, Kamyon, 30, kiralık 9.000\n06 KR 502, Kamyon, 18,5, Kiralık\n35 TS 9, Kamyon, taşeron\nEKS-02; Ekskavatör; ; kiralık 12000 TL",
    );
    expect(errors).toEqual([]);
    expect(
      vehicles.map((v) => [v.plate, v.capacity_ton, v.ownership, v.daily_rate]),
    ).toEqual([
      ["06 KR 501", 30, "rented", 9000],
      ["06 KR 502", 18.5, "rented", null],
      ["35 TS 9", null, "subcontractor", null],
      ["EKS-02", null, "rented", 12000],
    ]);
  });

  it("şablon birimleri geçerli birimlerdir", () => {
    for (const t of WORK_ITEM_TEMPLATES)
      expect(Object.keys(UNITS)).toContain(t.unit);
  });
});
