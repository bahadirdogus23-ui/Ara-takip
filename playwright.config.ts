import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Uçtan uca testler yerel Supabase yığınına karşı çalışır: önce ./scripts/e2e-stack.sh
function stackEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".e2e/env", "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  } catch {
    throw new Error("Yerel yığın çalışmıyor: önce ./scripts/e2e-stack.sh çalıştırın");
  }
}

const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  projects: [{ name: "telefon", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: "npx next build && npx next start -p 3000",
    url: "http://localhost:3000/giris",
    timeout: 300_000,
    reuseExistingServer: false,
    env: { ...stackEnv(), NEXT_TELEMETRY_DISABLED: "1" },
  },
});
