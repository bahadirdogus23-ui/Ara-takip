"use client";

import { AlertTriangle, Minus, Plus, Route, Truck } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { formatTrNumber } from "@/lib/number";
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
  vehicles: CounterVehicle[];
  routes: { id: string; name: string }[];
};

const ROUTE_KEY = "hafriyol_guzergah";
const timeNow = () =>
  new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());

export function TripCounter({ siteId, vehicles, routes }: Props) {
  const [routeId, setRouteId] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [, startTransition] = useTransition();

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
    const requestId = crypto.randomUUID();
    startTransition(async () => {
      adjust({ id: v.id, delta: 1 });
      const res = await tapTrip({ siteId, vehicleId: v.id, routeId: routeId || null, requestId });
      setMessage(res.ok ? { text: `${v.plate}: sefer kaydedildi` } : { text: res.error, error: true });
    });
  }

  function undo(v: CounterVehicle) {
    if (!confirm(`${v.plate} için son sefer geri alınsın mı?`)) return;
    startTransition(async () => {
      adjust({ id: v.id, delta: -1 });
      const res = await undoTrip({ siteId, vehicleId: v.id });
      setMessage(res.ok ? { text: `${v.plate}: son sefer geri alındı` } : { text: res.error, error: true });
    });
  }

  const total = shown.reduce((s, v) => s + v.trips, 0);
  const estTon = shown.reduce((s, v) => s + (v.capacityTon ? v.capacityTon * v.trips : 0), 0);

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

      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {message && <span className={message.error ? "text-red-600" : "text-green-700 dark:text-green-400"}>{message.text}</span>}
      </div>

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {shown.map((v) => (
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
