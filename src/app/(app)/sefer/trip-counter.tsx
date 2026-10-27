"use client";

import {
  AlertTriangle,
  CloudOff,
  Minus,
  Plus,
  RefreshCw,
  Route,
  Scale,
  Truck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { formatTrNumber, parseTrNumber } from "@/lib/number";
import {
  discardRejected,
  enqueue,
  flushQueue,
  mine,
  pendingByVehicle,
  QUEUE_EVENT,
  SENT_EVENT,
  readQueue,
  readRejected,
  retryRejected,
  withoutLastFor,
  writeQueue,
  type QueuedTap,
  type QueueOwner,
  type RejectedTap,
} from "@/lib/offline-queue";
import { tapTrip, undoTrip } from "./actions";

export type CounterVehicle = {
  id: string;
  plate: string;
  type: string;
  capacityTon: number | null;
  trips: number;
  realTon: number; // bugün girilen kantar tonu toplamı
  untonnedTrips: number; // tonu girilmemiş seferler (kapasiteyle tahmin edilir)
  lastAt: string | null; // "14:32"
  warning: string | null; // şişirilmiş sefer şüphesi
};

type Props = {
  tenantId: string;
  userId: string;
  siteId: string;
  today: string;
  vehicles: CounterVehicle[];
  routes: { id: string; name: string }[];
};

type Change = { id: string; delta: number; ton: number | null };

const ROUTE_KEY = "hafriyol_guzergah";
const TON_MODE_KEY = "hafriyol_ton_modu";
const LAST_TON_KEY = "hafriyol_son_ton";

const timeNow = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date());

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

export function TripCounter({
  tenantId,
  userId,
  siteId,
  today,
  vehicles,
  routes,
}: Props) {
  const owner: QueueOwner = useMemo(
    () => ({ tenantId, userId }),
    [tenantId, userId],
  );
  const [routeId, setRouteId] = useState<string>("");
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [, startTransition] = useTransition();
  // İnternet yokken girilen seferler (telefonda bekler)
  const [queue, setQueue] = useState<QueuedTap[]>([]);
  // Sunucunun kabul etmediği seferler (silinmez; kullanıcı tekrar dener ya da siler)
  const [rejected, setRejected] = useState<RejectedTap[]>([]);
  const [online, setOnline] = useState(true);
  // Kantar tonu modu: her seferde ton sorulur
  const [tonMode, setTonMode] = useState(false);
  const [tonFor, setTonFor] = useState<CounterVehicle | null>(null);
  const [tonText, setTonText] = useState("");
  const [tonError, setTonError] = useState<string | null>(null);

  // Bekleyenleri sırayla gönder (aynı işi uygulama kabuğu da her ekranda yapar)
  const flush = useCallback(() => flushQueue(tapTrip, owner), [owner]);

  useEffect(() => {
    const refresh = () => {
      setQueue(mine(readQueue(), owner));
      setRejected(mine(readRejected(), owner));
    };
    // Gönderim sonucu (bu ekran ya da uygulama kabuğu göndermiş olabilir)
    const report = (e: Event) => {
      const { sent, rejected: bad } = (
        e as CustomEvent<{ sent: number; rejected: number }>
      ).detail;
      if (bad)
        setMessage({
          text: `${bad} sefer sunucuya kabul edilmedi; aşağıdaki listeye bakın`,
          error: true,
        });
      else if (sent)
        setMessage({
          text: `İnternet geldi: bekleyen ${sent} sefer gönderildi`,
        });
    };
    refresh();
    setOnline(navigator.onLine);
    setTonMode(store.get(TON_MODE_KEY) === "1");
    if (navigator.onLine) void flush();
    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener(SENT_EVENT, report);
    return () => {
      window.removeEventListener(SENT_EVENT, report);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener(QUEUE_EVENT, refresh);
    };
  }, [flush, owner]);

  // Dokunuş sunucuya ulaşmadan sayı hemen artar; hata olursa eski hâline döner
  const [shown, adjust] = useOptimistic(vehicles, (state, c: Change) =>
    state.map((v) =>
      v.id === c.id
        ? {
            ...v,
            trips: Math.max(0, v.trips + c.delta),
            realTon: c.ton ? v.realTon + c.ton : v.realTon,
            untonnedTrips:
              c.delta > 0 && !c.ton ? v.untonnedTrips + 1 : v.untonnedTrips,
            lastAt: c.delta > 0 ? timeNow() : v.lastAt,
          }
        : v,
    ),
  );

  // Seçili güzergâh telefonda hatırlanır; hiç seçilmemişse ilk güzergâh (seferler imalata yazılsın)
  useEffect(() => {
    const saved = store.get(`${ROUTE_KEY}:${siteId}`);
    if (saved !== null && (saved === "" || routes.some((r) => r.id === saved)))
      setRouteId(saved);
    else if (routes.length) setRouteId(routes[0].id);
  }, [siteId, routes]);

  function chooseRoute(id: string) {
    setRouteId(id);
    store.set(`${ROUTE_KEY}:${siteId}`, id);
  }

  function toggleTonMode() {
    const next = !tonMode;
    setTonMode(next);
    store.set(TON_MODE_KEY, next ? "1" : "0");
  }

  function record(v: CounterVehicle, ton: number | null) {
    navigator.vibrate?.(25);
    const item: QueuedTap = {
      siteId,
      vehicleId: v.id,
      routeId: routeId || null,
      requestId: crypto.randomUUID(),
      entryDate: today,
      tonnage: ton,
      at: Date.now(),
      tenantId: owner.tenantId,
      userId: owner.userId,
    };
    const what = ton ? `${formatTrNumber(ton)} t sefer` : "sefer";
    if (!navigator.onLine) {
      enqueue(item);
      setMessage({
        text: `${v.plate}: internet yok, ${what} telefona kaydedildi`,
      });
      return;
    }
    startTransition(async () => {
      adjust({ id: v.id, delta: 1, ton });
      try {
        const res = await tapTrip(item);
        setMessage(
          res.ok
            ? { text: `${v.plate}: ${what} kaydedildi` }
            : { text: res.error, error: true },
        );
      } catch {
        // Bağlantı koptu: kaybolmasın, kuyruğa al
        enqueue(item);
        setMessage({
          text: `${v.plate}: bağlantı yok, ${what} telefona kaydedildi`,
        });
      }
    });
  }

  function tap(v: CounterVehicle) {
    if (!tonMode) return record(v, null);
    // Son girilen ton (aynı kamyon genelde benzer yük taşır) ya da kapasite önerilir
    const last = store.get(`${LAST_TON_KEY}:${v.id}`);
    setTonText(
      last ?? (v.capacityTon ? String(v.capacityTon).replace(".", ",") : ""),
    );
    setTonError(null);
    setTonFor(v);
  }

  function confirmTon(skip: boolean) {
    if (!tonFor) return;
    if (skip) {
      record(tonFor, null);
      setTonFor(null);
      return;
    }
    const ton = parseTrNumber(tonText);
    if (ton === null || ton <= 0 || ton > 200) {
      setTonError("Ton için 0 ile 200 arasında bir sayı girin, ör. 24,5");
      return;
    }
    store.set(`${LAST_TON_KEY}:${tonFor.id}`, tonText.trim());
    record(tonFor, Math.round(ton * 1000) / 1000);
    setTonFor(null);
  }

  function undo(v: CounterVehicle) {
    if (!confirm(`${v.plate} için son sefer geri alınsın mı?`)) return;
    // Henüz gönderilmemiş sefer varsa önce o geri alınır
    const local = withoutLastFor(readQueue(), siteId, v.id);
    if (local.removed) {
      writeQueue(local.queue);
      setMessage({ text: `${v.plate}: son sefer geri alındı` });
      return;
    }
    if (!navigator.onLine) {
      setMessage({
        text: "İnternet yokken gönderilmiş seferler geri alınamaz",
        error: true,
      });
      return;
    }
    startTransition(async () => {
      adjust({ id: v.id, delta: -1, ton: null });
      const res = await undoTrip({ siteId, vehicleId: v.id });
      setMessage(
        res.ok
          ? { text: `${v.plate}: son sefer geri alındı` }
          : { text: res.error, error: true },
      );
    });
  }

  // Gösterilen = sunucudaki + telefonda bekleyen
  const pending = pendingByVehicle(queue, siteId, today);
  const display = shown.map((v) => {
    const p = pending.get(v.id);
    return p
      ? {
          ...v,
          trips: v.trips + p.trips,
          realTon: v.realTon + p.ton,
          untonnedTrips: v.untonnedTrips + p.untonned,
        }
      : v;
  });
  const waiting = queue.length;
  const total = display.reduce((s, v) => s + v.trips, 0);
  // Kantar tonu girilmişse o, girilmemiş seferler için araç kapasitesi
  const tons = display.reduce(
    (s, v) =>
      s + v.realTon + (v.capacityTon ? v.capacityTon * v.untonnedTrips : 0),
    0,
  );
  const allReal = display.every((v) => v.untonnedTrips === 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card py-3">
          <p className="text-xs text-muted">Bugün toplam</p>
          <p className="text-3xl font-extrabold tabular-nums">{total}</p>
          <p className="text-xs text-muted">sefer</p>
        </div>
        <div className="card py-3">
          <p className="text-xs text-muted">
            {allReal ? "Taşınan" : "Taşınan (tahmini)"}
          </p>
          <p className="text-3xl font-extrabold tabular-nums">
            {tons ? formatTrNumber(tons, 1) : "—"}
          </p>
          <p className="text-xs text-muted">
            {allReal
              ? "ton, kantar"
              : "ton; tonu girilmeyen seferler kapasiteyle"}
          </p>
        </div>
      </div>

      {routes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Route className="size-4" aria-hidden /> Güzergâh
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...routes, { id: "", name: "Güzergâhsız" }].map((r) => (
              <button
                key={r.id || "none"}
                type="button"
                onClick={() => chooseRoute(r.id)}
                aria-pressed={routeId === r.id}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${
                  routeId === r.id
                    ? "border-brand bg-brand text-white dark:text-black"
                    : "border-line bg-surface"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Scale className="size-5 text-brand" aria-hidden />
          Her seferde kantar tonu gir
        </span>
        <input
          type="checkbox"
          checked={tonMode}
          onChange={toggleTonMode}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-7 w-12 rounded-full bg-line transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5"
        />
      </label>

      {(waiting > 0 || !online) && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {online ? (
            <RefreshCw className="size-5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <CloudOff className="size-5 shrink-0" aria-hidden />
          )}
          <span>
            {online ? "Gönderiliyor… " : "İnternet yok. "}
            {waiting > 0
              ? `${waiting} sefer telefonda bekliyor, bağlantı gelince otomatik gönderilecek.`
              : "Seferler telefona kaydedilir."}
          </span>
        </div>
      )}

      {rejected.length > 0 && (
        <section className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />{" "}
            Gönderilemeyen seferler ({rejected.length})
          </h2>
          <p className="mt-1 text-xs">
            Telefonda duruyorlar, silinmediler. Sebebi düzeltip tekrar deneyin
            ya da yöneticinize iletin.
          </p>
          <ul className="mt-2 divide-y divide-red-200 dark:divide-red-900">
            {rejected.map((r) => (
              <li
                key={r.requestId}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium">
                    {vehicles.find((v) => v.id === r.vehicleId)?.plate ??
                      "Araç"}{" "}
                    · {r.entryDate.split("-").reverse().join(".")}
                    {r.tonnage ? ` · ${formatTrNumber(r.tonnage)} t` : ""}
                  </span>
                  <span className="block text-xs">{r.error}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="btn-secondary min-h-9 px-3 text-xs"
                    onClick={() => {
                      retryRejected(r.requestId);
                      void flush();
                    }}
                  >
                    Tekrar dene
                  </button>
                  <button
                    type="button"
                    className="min-h-9 px-2 text-xs font-medium text-red-700 dark:text-red-400"
                    onClick={() => {
                      if (confirm("Bu sefer kalıcı olarak silinsin mi?"))
                        discardRejected(r.requestId);
                    }}
                  >
                    Sil
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {message && (
          <span
            className={
              message.error
                ? "text-red-600"
                : "text-green-700 dark:text-green-400"
            }
          >
            {message.text}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {display.map((v) => (
          <li
            key={v.id}
            className={`card min-w-0 p-3 ${v.warning ? "border-red-400 dark:border-red-700" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-strong min-[400px]:flex">
                <Truck className="size-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold tabular-nums">
                  {v.plate}
                </p>
                <p className="truncate text-xs text-muted">
                  {v.realTon > 0 ? `${formatTrNumber(v.realTon, 1)} t` : v.type}
                  {v.lastAt && ` · son ${v.lastAt}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => undo(v)}
                disabled={v.trips === 0}
                aria-label={`${v.plate} son seferi geri al`}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted disabled:opacity-30"
              >
                <Minus className="size-5" aria-hidden />
              </button>
              <span
                className="w-9 text-center text-2xl font-extrabold tabular-nums"
                aria-label={`${v.trips} sefer`}
              >
                {v.trips}
              </span>
              <button
                type="button"
                onClick={() => tap(v)}
                aria-label={`${v.plate} +1 sefer`}
                className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-md active:scale-95 dark:text-black"
              >
                <Plus className="size-9" aria-hidden strokeWidth={3} />
              </button>
            </div>
            {v.warning && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                Fazla sefer şüphesi · {v.warning}
              </p>
            )}
          </li>
        ))}
      </ul>

      {tonFor && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center"
          onClick={() => setTonFor(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="ton-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              confirmTon(false);
            }}
            className="w-full space-y-3 rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-2xl"
          >
            <h2 id="ton-title" className="text-lg font-bold">
              {tonFor.plate} · kantar tonu
            </h2>
            <label className="block space-y-1">
              <span className="sr-only">Ton</span>
              <input
                autoFocus
                inputMode="decimal"
                value={tonText}
                onChange={(e) => setTonText(e.target.value)}
                placeholder="ör. 24,5"
                aria-invalid={!!tonError}
                className="input text-center text-3xl font-bold tabular-nums"
              />
            </label>
            {tonError && <p className="text-sm text-red-600">{tonError}</p>}
            <button type="submit" className="btn-primary w-full text-lg">
              Seferi kaydet
            </button>
            <button
              type="button"
              onClick={() => confirmTon(true)}
              className="btn-secondary w-full"
            >
              Tonsuz kaydet
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
