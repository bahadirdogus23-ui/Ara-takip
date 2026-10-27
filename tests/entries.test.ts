import { describe, expect, it } from "vitest";
import {
  expenseSchema,
  normalizePlate,
  productionSchema,
  toFieldErrors,
  tripSchema,
  vehicleSchema,
  workItemSchema,
} from "@/lib/validation";

const SITE = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";
const REQ = "33333333-3333-4333-8333-333333333333";

describe("iş kalemi", () => {
  it("Türkçe birim fiyatı ve boş planlanan miktarı ayrıştırır", () => {
    const r = workItemSchema.parse({
      code: "15.150.1001",
      name: "Kazı",
      unit: "m3",
      unit_price: "85,50",
      planned_quantity: "",
    });
    expect(r).toMatchObject({ unit_price: 85.5, planned_quantity: null });
  });

  it("kuruştan fazla basamağı reddeder", () => {
    const r = workItemSchema.safeParse({
      code: "",
      name: "Kazı",
      unit: "m3",
      unit_price: "85,555",
      planned_quantity: "",
    });
    expect(toFieldErrors(r.error!).unit_price).toBe(
      "Birim fiyat en fazla 2 ondalık basamak olabilir",
    );
  });

  it("geçersiz birimi reddeder", () => {
    const r = workItemSchema.safeParse({
      code: "",
      name: "Kazı",
      unit: "metrekup",
      unit_price: "",
      planned_quantity: "",
    });
    expect(toFieldErrors(r.error!).unit).toBe("Birim seçin");
  });
});

describe("araç", () => {
  it.each([
    ["06abc123", "06 ABC 123"],
    ["06 abc 123", "06 ABC 123"],
    ["34-ğş-1234", "34 ĞŞ 1234"],
    ["  EKS-07  ", "EKS-07"], // plaka kalıbında değil (iş makinesi no) → olduğu gibi, büyük harf
  ])("%s → %s", (raw, expected) => {
    expect(normalizePlate(raw)).toBe(expected);
  });

  it("kapasite sıfır olamaz, aktif kutusu işlenir", () => {
    const bad = vehicleSchema.safeParse({
      plate: "06abc123",
      vehicle_type: "Kamyon",
      ownership: "own",
      capacity_ton: "0",
    });
    expect(toFieldErrors(bad.error!).capacity_ton).toBe(
      "Kapasite 0'dan büyük olmalı",
    );
    const ok = vehicleSchema.parse({
      plate: "06abc123",
      vehicle_type: "Kamyon",
      ownership: "rented",
      capacity_ton: "25",
      active: "on",
    });
    expect(ok).toMatchObject({
      plate: "06 ABC 123",
      capacity_ton: 25,
      active: true,
    });
  });
});

describe("imalat kaydı", () => {
  const base = {
    site_id: SITE,
    work_item_id: ITEM,
    entry_date: "2026-10-23",
    note: "",
    client_request_id: REQ,
  };

  it("virgüllü miktarı kabul eder", () => {
    expect(
      productionSchema.parse({ ...base, quantity: "120,5" }).quantity,
    ).toBe(120.5);
  });

  it.each([
    ["0", "Miktar 0'dan büyük olmalı"],
    ["-5", "Miktar 0'dan büyük olmalı"],
    ["", "Miktar girin"],
    ["on iki", "Miktar için geçerli bir sayı girin"],
    ["1,2345", "Miktar en fazla 3 ondalık basamak olabilir"],
  ])("%s → %s", (quantity, message) => {
    const r = productionSchema.safeParse({ ...base, quantity });
    expect(toFieldErrors(r.error!).quantity).toBe(message);
  });

  it("iş kalemi seçilmezse uyarır", () => {
    const r = productionSchema.safeParse({
      ...base,
      work_item_id: "",
      quantity: "5",
    });
    expect(toFieldErrors(r.error!).work_item_id).toBe("İş kalemi seçin");
  });
});

describe("sefer kaydı", () => {
  const base = {
    site_id: SITE,
    vehicle_id: ITEM,
    route_id: "",
    entry_date: "2026-10-23",
    tonnage: "",
    note: "",
    client_request_id: REQ,
  };

  it("güzergâh ve tonaj isteğe bağlıdır", () => {
    expect(tripSchema.parse({ ...base, trip_count: "12" })).toMatchObject({
      trip_count: 12,
      route_id: null,
      tonnage: null,
    });
  });

  it("sefer sayısı tam sayı ve en fazla 500 olmalı", () => {
    expect(
      toFieldErrors(tripSchema.safeParse({ ...base, trip_count: "2,5" }).error!)
        .trip_count,
    ).toBe("Sefer sayısı tam sayı olmalı");
    expect(
      toFieldErrors(tripSchema.safeParse({ ...base, trip_count: "501" }).error!)
        .trip_count,
    ).toBe("Sefer sayısı çok büyük");
  });
});

describe("gider", () => {
  const base = {
    site_id: SITE,
    work_item_id: "",
    expense_date: "2026-10-23",
    category: "fuel",
    vat_rate: "20",
    supplier: "",
    description: "",
    client_request_id: REQ,
  };

  it("tutarı ve KDV oranını sayıya çevirir", () => {
    expect(expenseSchema.parse({ ...base, amount: "1.234,56" })).toMatchObject({
      amount: 1234.56,
      vat_rate: 20,
      work_item_id: null,
    });
  });

  it("geçersiz KDV oranını reddeder", () => {
    const r = expenseSchema.safeParse({
      ...base,
      amount: "100",
      vat_rate: "18",
    });
    expect(toFieldErrors(r.error!).vat_rate).toBe("KDV oranı seçin");
  });
});
