// Yerel test yığını için Supabase API ağ geçidi taklidi:
//   /auth/v1/*  → Supabase Auth (GoTrue)
//   /rest/v1/*  → PostgREST
//   /storage/v1/* → Supabase Storage (fotoğraflar)
// Gerçek Supabase'te bu işi Kong yapar.
import http from "node:http";

const [port, authPort, restPort, storagePort] = process.argv.slice(2).map(Number);

const routes = [
  ["/auth/v1", authPort],
  ["/rest/v1", restPort],
  ["/storage/v1", storagePort],
];

// Tarayıcıdan doğrudan yapılan istekler (fotoğraf yükleme) için CORS: gerçek Supabase'te
// Kong her kökene izin verir; burada da aynısı.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,apikey,content-type,x-client-info,x-upsert,cache-control,accept-profile,content-profile,prefer,range",
  "access-control-expose-headers": "content-range,content-length,etag",
  "access-control-max-age": "3600",
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS).end();
      return;
    }
    const match = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!match) {
      res.writeHead(404).end("bilinmeyen yol");
      return;
    }
    const [prefix, target] = match;
    const upstream = http.request(
      { host: "127.0.0.1", port: target, path: req.url.slice(prefix.length) || "/", method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...CORS });
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502).end(String(e));
    });
    req.pipe(upstream);
  })
  .listen(port, "127.0.0.1");
