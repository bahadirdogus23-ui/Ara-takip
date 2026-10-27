"use client";

import { useEffect } from "react";

// Service worker yalnızca canlı sürümde kaydedilir (geliştirmede önbellek kafa karıştırmasın)
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

// Çıkışta önbelleğe alınmış sayfaları sil
export function clearCachedPages() {
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
  try {
    localStorage.removeItem("hafriyol_kuyruk");
  } catch {}
}
