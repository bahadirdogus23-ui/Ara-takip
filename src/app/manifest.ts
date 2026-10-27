import type { MetadataRoute } from "next";

// Telefona "Ana ekrana ekle" ile uygulama gibi kurulur
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hafriyol: Şantiye takibi",
    short_name: "Hafriyol",
    description:
      "Yol, altyapı ve hafriyat şantiyeleri için sefer, imalat, makine ve gider takibi",
    lang: "tr",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f5f2",
    theme_color: "#d97706",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
