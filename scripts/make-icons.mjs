// Uygulama simgelerini (PWA, iPhone ana ekran) üretir: node scripts/make-icons.mjs
// Turuncu zemin üzerinde beyaz kamyon. Çıktı: public/icons/*.png
import { chromium } from "@playwright/test";

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
  <rect width="24" height="24" fill="#d97706"/>
  <g transform="translate(${pad} ${pad}) scale(${(24 - 2 * pad) / 24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
    <path d="M15 18H9"/>
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
    <circle cx="17" cy="18" r="2"/>
    <circle cx="7" cy="18" r="2"/>
  </g>
</svg>`;

const targets = [
  { file: "icon-192.png", size: 192, pad: 4 },
  { file: "icon-512.png", size: 512, pad: 4 },
  { file: "maskable-512.png", size: 512, pad: 6 }, // Android maskeleme için daha geniş kenar boşluğu
  { file: "apple-touch-icon.png", size: 180, pad: 4 },
];

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0">${svg(t.pad)}</body></html>`);
  await page.screenshot({ path: `public/icons/${t.file}`, clip: { x: 0, y: 0, width: t.size, height: t.size } });
}
await browser.close();
console.log("Simgeler üretildi");
