"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, NumberField, SelectField, SubmitButton } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { formatTrNumber } from "@/lib/number";
import { UNITS } from "@/lib/validation";
import { saveRoute, saveWorkItem } from "./actions";

const unitOptions = Object.entries(UNITS).map(([value, label]) => ({ value, label }));

// Sayıyı forma Türkçe yazılmış hâliyle koy (85.5 → "85,5")
const num = (v: number | null) => (v === null ? "" : formatTrNumber(v, 3).replace(/\./g, ""));

export function WorkItemForm({ siteId, item }: { siteId: string; item?: Tables<"work_items"> }) {
  const [state, action] = useActionState(saveWorkItem, null);
  const p = item ? `wi-${item.id}` : "wi-new";
  return (
    // Yeni kayıt başarıyla eklenince form sıfırlanır
    <form key={item ? undefined : state?.ok} action={action} className="space-y-3" noValidate>
      <FormError state={state} />
      <FormSuccess state={state} />
      <input type="hidden" name="site_id" value={siteId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field idPrefix={p} name="code" label="Poz no" defaultValue={item?.code} state={state} />
        <Field idPrefix={p} name="name" label="İş kalemi" defaultValue={item?.name} state={state} required />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SelectField idPrefix={p} name="unit" label="Birim" options={unitOptions} defaultValue={item?.unit ?? "m3"} state={state} required />
        <NumberField idPrefix={p} name="unit_price" label="Birim fiyat (TL)" defaultValue={num(item?.unit_price ?? null)} hint="KDV hariç" state={state} />
        <NumberField idPrefix={p} name="planned_quantity" label="Planlanan miktar" defaultValue={num(item?.planned_quantity ?? null)} state={state} />
      </div>
      <SubmitButton>{item ? "Kaydet" : "İş kalemi ekle"}</SubmitButton>
    </form>
  );
}

export function RouteForm({ siteId, route }: { siteId: string; route?: Tables<"routes"> }) {
  const [state, action] = useActionState(saveRoute, null);
  const p = route ? `rt-${route.id}` : "rt-new";
  return (
    <form key={route ? undefined : state?.ok} action={action} className="space-y-3" noValidate>
      <FormError state={state} />
      <FormSuccess state={state} />
      <input type="hidden" name="site_id" value={siteId} />
      {route && <input type="hidden" name="id" value={route.id} />}
      <Field idPrefix={p} name="name" label="Güzergâh adı" defaultValue={route?.name} hint="Ör. Ocak → Km 3+200 dolgu" state={state} required />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field idPrefix={p} name="origin" label="Nereden" defaultValue={route?.origin} state={state} />
        <Field idPrefix={p} name="destination" label="Nereye" defaultValue={route?.destination} state={state} />
        <NumberField idPrefix={p} name="distance_km" label="Mesafe (km)" defaultValue={num(route?.distance_km ?? null)} state={state} />
      </div>
      <NumberField
        idPrefix={p}
        name="trip_price"
        label="Taşerona sefer başı ücret (TL)"
        defaultValue={num(route?.trip_price ?? null)}
        hint="KDV hariç; taşeron hakedişi bununla hesaplanır"
        state={state}
      />
      <NumberField
        idPrefix={p}
        name="cycle_minutes"
        label="Bir seferin süresi (dakika, gidiş-dönüş)"
        defaultValue={num(route?.cycle_minutes ?? null)}
        hint="Boş bırakılırsa mesafeden tahmin edilir. Günde yapılabilecek sefer sınırı buradan hesaplanır."
        state={state}
      />
      <SubmitButton>{route ? "Kaydet" : "Güzergâh ekle"}</SubmitButton>
    </form>
  );
}
