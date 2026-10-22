import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Hafriyol", template: "%s · Hafriyol" },
  description: "Yol, altyapı ve hafriyat şantiyeleri için imalat, sefer ve gider takibi",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
