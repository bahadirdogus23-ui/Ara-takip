import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF kütüphanesi sunucuda paketlenmeden Node modülü olarak çalışır
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF'e gömülen Türkçe karakterli font, sunucu paketine dahil edilir
  outputFileTracingIncludes: {
    "/rapor/pdf": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
