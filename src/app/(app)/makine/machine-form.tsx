"use client";

import { useActionState } from "react";
import {
  Field,
  FormError,
  FormSuccess,
  NumberField,
  SelectField,
  SubmitButton,
  type Option,
} from "@/components/form";
import { saveMachineLog } from "./actions";

export function MachineForm({
  siteId,
  date,
  requestId,
  machines,
}: {
  siteId: string;
  date: string;
  requestId: string;
  machines: Option[];
}) {
  const [state, action] = useActionState(saveMachineLog, null);
  return (
    <form key={state?.ok} action={action} className="space-y-3" noValidate>
      <FormSuccess state={state} />
      <FormError state={state} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="log_date" value={date} />
      <input
        type="hidden"
        name="client_request_id"
        value={state?.ok ?? requestId}
      />
      <SelectField
        idPrefix="mk"
        name="vehicle_id"
        label="Makine / araç"
        options={machines}
        placeholder="Seçin…"
        state={state}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          idPrefix="mk"
          name="hours"
          label="Çalışma (saat)"
          placeholder="ör. 9,5"
          state={state}
        />
        <NumberField
          idPrefix="mk"
          name="fuel_liters"
          label="Mazot (litre)"
          placeholder="ör. 180"
          state={state}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix="mk"
          name="operator"
          label="Operatör"
          autoComplete="name"
          state={state}
        />
        <Field
          idPrefix="mk"
          name="note"
          label="Not"
          hint="Arıza, bekleme nedeni…"
          state={state}
        />
      </div>
      <SubmitButton>Kaydet</SubmitButton>
    </form>
  );
}
