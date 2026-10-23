"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, NumberField, SelectField, SubmitButton, type Option } from "@/components/form";
import { saveProduction, saveTrip } from "./actions";

type Common = { siteId: string; date: string; requestId: string };

export function ProductionForm({ siteId, date, requestId, items }: Common & { items: Option[] }) {
  const [state, action] = useActionState(saveProduction, null);
  return (
    // Başarılı kayıttan sonra form yeniden kurulur: miktar boşalır, kalem seçili kalır
    <form key={state?.ok} action={action} className="space-y-3" noValidate>
      <FormSuccess state={state} />
      <FormError state={state} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="client_request_id" value={state?.ok ?? requestId} />
      <SelectField idPrefix="pr" name="work_item_id" label="İş kalemi" options={items} placeholder="Seçin…" state={state} required />
      <NumberField idPrefix="pr" name="quantity" label="Miktar" placeholder="ör. 120,5" state={state} required />
      <Field idPrefix="pr" name="note" label="Not" state={state} />
      <SubmitButton>İmalatı kaydet</SubmitButton>
    </form>
  );
}

export function TripForm({
  siteId,
  date,
  requestId,
  vehicles,
  routes,
}: Common & { vehicles: Option[]; routes: Option[] }) {
  const [state, action] = useActionState(saveTrip, null);
  return (
    <form key={state?.ok} action={action} className="space-y-3" noValidate>
      <FormSuccess state={state} />
      <FormError state={state} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="client_request_id" value={state?.ok ?? requestId} />
      <SelectField idPrefix="tr" name="vehicle_id" label="Araç" options={vehicles} placeholder="Seçin…" state={state} required />
      <SelectField idPrefix="tr" name="route_id" label="Güzergâh" options={routes} placeholder="— Seçilmedi —" state={state} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField idPrefix="tr" name="trip_count" label="Sefer sayısı" placeholder="ör. 12" state={state} required />
        <NumberField idPrefix="tr" name="tonnage" label="Toplam ton" hint="İsteğe bağlı" state={state} />
      </div>
      <Field idPrefix="tr" name="note" label="Not" state={state} />
      <SubmitButton>Seferi kaydet</SubmitButton>
    </form>
  );
}
