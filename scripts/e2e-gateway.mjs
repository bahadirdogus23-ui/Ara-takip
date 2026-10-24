// Yerel test yığını için Supabase API ağ geçidi taklidi:
//   /auth/v1/*  → Supabase Auth (GoTrue)
//   /rest/v1/*  → PostgREST
// Gerçek Supabase'te bu işi Kong yapar.
import http from "node:http";

const [port, authPort, restPort] = process.argv.slice(2).map(Number);

const routes = [
  ["/auth/v1", authPort],
  ["/rest/v1", restPort],
];

http
  .createServer((req, res) => {
    const match = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!match) {
      res.writeHead(404).end("bilinmeyen yol");
      return;
    }
    const [prefix, target] = match;
    const upstream = http.request(
      { host: "127.0.0.1", port: target, path: req.url.slice(prefix.length) || "/", method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502).end(String(e));
    });
    req.pipe(upstream);
  })
  .listen(port, "127.0.0.1");
