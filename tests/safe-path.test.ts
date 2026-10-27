import { describe, expect, it } from "vitest";
import { safePath } from "@/lib/safe-path";

describe("güvenli yönlendirme", () => {
  it("uygulama içi yolları kabul eder", () => {
    expect(safePath("/rapor?santiye=1")).toBe("/rapor?santiye=1");
    expect(safePath("/sifre-yenile")).toBe("/sifre-yenile");
  });
  it("başka siteye gidebilecek değerleri reddeder", () => {
    for (const v of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "/\tevil",
      "evil",
      "",
      null,
    ])
      expect(safePath(v)).toBe("/panel");
  });
});
