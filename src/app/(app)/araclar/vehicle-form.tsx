"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, NumberField, SelectField, SubmitButton } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { VEHICLE_OWNERSHIP } from "@/lib/validation";
import { saveVehicle } from "./actions";

const ownershipOptions = Object.entries(VEHICLE_OWNERSHIP).map(([value, label]) => ({ value, label }));

export function VehicleForm({ vehicle }: { vehicle?: Tables<"vehicles"> }) {
  const [state, action] = useActionState(saveVehicle, null);
  const p = vehicle ? `vh-${vehicle.id}` : "vh-new";
  const active = state?.values ? state.values.active === "on" : (vehicle?.active ?? true);

  return (
    <form key={vehicle ? undefined : state?.ok} action={action} className="space-y-3" noValidate>
      <FormError state={state} />
      <FormSuccess state={state} />
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field idPrefix={p} name="plate" label="Plaka / makine no" defaultValue={vehicle?.plate} state={state} required />
        <Field idPrefix={p} name="vehicle_type" label="Tür" defaultValue={vehicle?.vehicle_type} hint="Kamyon, ekskavatör, greyder…" state={state} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField idPrefix={p} name="ownership" label="Mülkiyet" options={ownershipOptions} defaultValue={vehicle?.ownership ?? "own"} state={state} required />
        <NumberField
          idPrefix={p}
          name="capacity_ton"
          label="Kapasite (ton)"
          defaultValue={vehicle?.capacity_ton === null || vehicle?.capacity_ton === undefined ? "" : String(vehicle.capacity_ton).replace(".", ",")}
          state={state}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} className="size-5 accent-[var(--brand)]" />
        Aktif (sefer girişinde listelenir)
      </label>
      <SubmitButton>{vehicle ? "Kaydet" : "Araç ekle"}</SubmitButton>
    </form>
  );
}
