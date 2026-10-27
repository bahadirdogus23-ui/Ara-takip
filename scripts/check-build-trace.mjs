// Derleme sonrası denetim: canlı (Vercel) paketine yalnızca izlenen dosyalar girer.
// PDF ucunun ihtiyaç duyduğu dinamik yüklenen dosyalar izde yoksa hata verir.
import { readFileSync } from "node:fs";

const trace = ".next/server/app/(app)/rapor/pdf/route.js.nft.json";
const files = JSON.parse(readFileSync(trace, "utf8")).files;
const required = [
  "pdfkit/js/standard-fonts/Helvetica.cjs",
  "pdfkit/js/data/sRGB_IEC61966_2_1.icc",
  "assets/fonts/NotoSans-Regular.ttf",
];
const missing = required.filter((r) => !files.some((f) => f.endsWith(r)));
if (missing.length) {
  console.error(`PDF paketinde eksik dosyalar: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`PDF paketi tamam (${files.length} dosya)`);
