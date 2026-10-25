import { describe, expect, it } from "vitest";
import { isValidPhotoPath, photoPath } from "@/lib/photos";

const T = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";

describe("fotoğraf yolu", () => {
  it("firma/şantiye/gün/uuid.jpg biçiminde üretir ve doğrular", () => {
    const p = photoPath(T, S, "2026-10-25", F);
    expect(p).toBe(`${T}/${S}/2026-10-25/${F}.jpg`);
    expect(isValidPhotoPath(p, T, S)).toBe(true);
  });

  it("başka firma/şantiye ya da kaçamak yolları reddeder", () => {
    expect(isValidPhotoPath(photoPath(S, S, "2026-10-25", F), T, S)).toBe(false);
    expect(isValidPhotoPath(`${T}/${S}/2026-10-25/../../x.jpg`, T, S)).toBe(false);
    expect(isValidPhotoPath(`${T}/${S}/2026-10-25/${F}.php`, T, S)).toBe(false);
  });
});
