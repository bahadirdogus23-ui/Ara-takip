import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF kütüphanesi sunucuda paketlenmeden Node modülü olarak çalışır
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF'e gömülen Türkçe karakterli font sunucu paketine dahil edilir. pdfkit standart
  // fontlarını ("#standard-fonts/*") ve renk profilini dinamik yüklediği için Next'in dosya
  // izleyicisi bunları görmez; eklenmezse canlıda PDF "Cannot find module" hatası verir.
  outputFileTracingIncludes: {
    "/rapor/pdf": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
};

export default nextConfig;
