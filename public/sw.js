// Hafriyol service worker: şantiyede internet yokken uygulama açılabilsin.
// - Next.js'in değişmeyen dosyaları (/_next/static) önbellekten
// - Sayfalar önce ağdan; ağ yoksa en son açılan hâli önbellekten
// - Form gönderimleri (POST) önbelleğe alınmaz; çevrimdışı seferler uygulama içinde kuyruğa yazılır
const VERSION = "v1";
const STATIC = `hafriyol-static-${VERSION}`;
const PAGES = `hafriyol-pages-${VERSION}`;
const OFFLINE_HTML = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>İnternet yok · Hafriyol</title><body style="font-family:system-ui;padding:32px;text-align:center;background:#f6f5f2;color:#1c1a17">
<h1 style="font-size:22px">İnternet bağlantısı yok</h1><p>Bu sayfa daha önce açılmadığı için gösterilemiyor.
Sefer sayacını internet varken bir kez açtıysanız, oradan sefer girmeye devam edebilirsiniz.</p>
<p><a href="/sefer" style="color:#b45309;font-weight:600">Sefer sayacına git</a></p></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("hafriyol-") && ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Tam sayfa açılışları (adres çubuğu, yenileme)
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        const key = url.pathname; // sorgu dizgisi farklı olsa da sayfanın son hâli kullanılır
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected) cache.put(key, res.clone());
          return res;
        } catch {
          return (await cache.match(key)) ?? new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
      })(),
    );
  }
});

// Çıkış yapılınca önbellekteki sayfalar silinir (aynı telefonu başkası kullanabilir)
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});
