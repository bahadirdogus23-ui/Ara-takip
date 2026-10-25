"use client";

import { AlertTriangle, CloudOff, Minus, Plus, RefreshCw, Route, Truck } from "lucide-react";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { formatTrNumber } from "@/lib/number";
import { pendingByVehicle, readQueue, withoutLastFor, writeQueue, type QueuedTap } from "@/lib/offline-queue";
import { tapTrip, undoTrip } from "./actions";

export type CounterVehicle = {
  id: string;
  plate: string;
  type: string;
  capacityTon: number | null;
  trips: number;
  lastAt: string | null; // "14:32"
  warning: string | null; // şişirilmiş sefer şüphesi
};

type Props = {
  siteId: string;
  today: string;
  vehicles: CounterVehicle[];
  routes: { id: string; name: string }[];
};

const ROUTE_KEY = "hafriyol_guzergah";
const timeNow = () =>
  new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());

export function TripCounter({ siteId, today, vehicles, routes }: Props) {
  const [routeId, setRouteId] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [, startTransition] = useTransition();
  // İnternet yokken girilen seferler (telefonda bekler)
  const [queue, setQueue] = useState<QueuedTap[]>([]);
  const [online, setOnline] = useState(true);
  const flushing = useRef(false);

  const enqueue = useCallback((t: QueuedTap) => {
    const next = [...readQueue(), t];
    writeQueue(next);
    setQueue(next);
  }, []);

  // Bekleyenleri sırayla gönder; ağ hatasında dur, sonra tekrar denenir
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const t of readQueue()) {
        let res;
        try {
          res = await tapTrip(t);
        } catch {
          break;
        }
        writeQueue(readQueue().filter((q) => q.requestId !== t.requestId));
        if (res.ok) sent++;
        else setMessage({ text: res.error, error: true });
      }
    } finally {
      flushing.current = false;
      setQueue(readQueue());
      if (sent) setMessage({ text: `İnternet geldi: bekleyen ${sent} sefer gönderildi` });
    }
  }, []);

  useEffect(() => {
    setQueue(readQueue());
    setOnline(navigator.onLine);
    if (navigator.onLine) void flush();
    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [flush]);

  // Dokunuş sunucuya ulaşmadan sayı hemen artar; hata olursa eski hâline döner
  const [shown, adjust] = useOptimistic(vehicles, (state, change: { id: string; delta: number }) =>
    state.map((v) =>
      v.id === change.id
        ? { ...v, trips: Math.max(0, v.trips + change.delta), lastAt: change.delta > 0 ? timeNow() : v.lastAt }
        : v,
    ),
  );

  // Seçili güzergâh telefonda hatırlanır
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${ROUTE_KEY}:${siteId}`);
      if (saved && routes.some((r) => r.id === saved)) setRouteId(saved);
    } catch {}
  }, [siteId, routes]);

  function chooseRoute(id: string) {
    setRouteId(id);
    try {
      localStorage.setItem(`${ROUTE_KEY}:${siteId}`, id);
    } catch {}
  }

  function tap(v: CounterVehicle) {
    navigator.vibrate?.(25);
    const item: QueuedTap = {
      siteId,
      vehicleId: v.id,
      routeId: routeId || null,
      requestId: crypto.randomUUID(),
      entryDate: today,
      at: Date.now(),
    };
    if (!navigator.onLine) {
      enqueue(item);
      setMessage({ text: `${v.plate}: internet yok, sefer telefona kaydedildi` });
      return;
    }
    startTransition(async () => {
      adjust({ id: v.id, delta: 1 });
      try {
        const res = await tapTrip(item);
        setMessage(res.ok ? { text: `${v.plate}: sefer kaydedildi` } : { text: res.error, error: true });
      } catch {
        // Bağlantı koptu: kaybolmasın, kuyruğa al
        enqueue(item);
        setMessage({ text: `${v.plate}: bağlantı yok, sefer telefona kaydedildi` });
      }
    });
  }

  function undo(v: CounterVehicle) {
    if (!confirm(`${v.plate} için son sefer geri alınsın mı?`)) return;
    // Henüz gönderilmemiş sefer varsa önce o geri alınır
    const local = withoutLastFor(readQueue(), siteId, v.id);
    if (local.removed) {
      writeQueue(local.queue);
      setQueue(local.queue);
      setMessage({ text: `${v.plate}: son sefer geri alındı` });
      return;
    }
    if (!navigator.onLine) {
      setMessage({ text: "İnternet yokken gönderilmiş seferler geri alınamaz", error: true });
      return;
    }
    startTransition(async () => {
      adjust({ id: v.id, delta: -1 });
      const res = await undoTrip({ siteId, vehicleId: v.id });
      setMessage(res.ok ? { text: `${v.plate}: son sefer geri alındı` } : { text: res.error, error: true });
    });
  }

  // Gösterilen sayı = sunucudaki + telefonda bekleyen
  const pending = pendingByVehicle(queue, siteId, today);
  const display = shown.map((v) => ({ ...v, trips: v.trips + (pending.get(v.id) ?? 0) }));
  const waiting = queue.length;
  const total = display.reduce((s, v) => s + v.trips, 0);
  const estTon = display.reduce((s, v) => s + (v.capacityTon ? v.capacityTon * v.trips : 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card py-3">
          <p className="text-xs text-muted">Bugün toplam</p>
          <p className="text-3xl font-extrabold tabular-nums">{total}</p>
          <p className="text-xs text-muted">sefer</p>
        </div>
        <div className="card py-3">
          <p className="text-xs text-muted">Tahmini taşınan</p>
          <p className="text-3xl font-extrabold tabular-nums">{estTon ? formatTrNumber(estTon, 0) : "—"}</p>
          <p className="text-xs text-muted">ton (araç kapasitesine göre)</p>
        </div>
      </div>

      {routes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Route className="size-4" aria-hidden /> Güzergâh
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: "", name: "Seçilmedi" }, ...routes].map((r) => (
              <button
                key={r.id || "none"}
                type="button"
                onClick={() => chooseRoute(r.id)}
                aria-pressed={routeId === r.id}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${
                  routeId === r.id ? "border-brand bg-brand text-white dark:text-black" : "border-line bg-surface"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

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

      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {message && <span className={message.error ? "text-red-600" : "text-green-700 dark:text-green-400"}>{message.text}</span>}
      </div>

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {display.map((v) => (
          <li key={v.id} className={`card min-w-0 p-3 ${v.warning ? "border-red-400 dark:border-red-700" : ""}`}>
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-strong min-[400px]:flex">
                <Truck className="size-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold tabular-nums">{v.plate}</p>
                <p className="truncate text-xs text-muted">
                  {v.type}
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
              <span className="w-9 text-center text-2xl font-extrabold tabular-nums" aria-label={`${v.trips} sefer`}>
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
    </div>
  );
}
