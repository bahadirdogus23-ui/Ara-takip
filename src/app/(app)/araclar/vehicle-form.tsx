"use client";

import { useActionState } from "react";
import {
  Field,
  FormError,
  FormSuccess,
  NumberField,
  SelectField,
  SubmitButton,
} from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { VEHICLE_OWNERSHIP } from "@/lib/validation";
import { saveVehicle } from "./actions";

const trNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

const ownershipOptions = Object.entries(VEHICLE_OWNERSHIP).map(
  ([value, label]) => ({ value, label }),
);

export function VehicleForm({ vehicle }: { vehicle?: Tables<"vehicles"> }) {
  const [state, action] = useActionState(saveVehicle, null);
  const p = vehicle ? `vh-${vehicle.id}` : "vh-new";
  const active = state?.values
    ? state.values.active === "on"
    : (vehicle?.active ?? true);

  return (
    <form
      key={vehicle ? undefined : state?.ok}
      action={action}
      className="space-y-3"
      noValidate
    >
      <FormError state={state} />
      <FormSuccess state={state} />
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field
          idPrefix={p}
          name="plate"
          label="Plaka / makine no"
          defaultValue={vehicle?.plate}
          state={state}
          required
        />
        <Field
          idPrefix={p}
          name="vehicle_type"
          label="Tür"
          defaultValue={vehicle?.vehicle_type}
          hint="Kamyon, ekskavatör, greyder…"
          state={state}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          idPrefix={p}
          name="ownership"
          label="Mülkiyet"
          options={ownershipOptions}
          defaultValue={vehicle?.ownership ?? "own"}
          state={state}
          required
        />
        <NumberField
          idPrefix={p}
          name="capacity_ton"
          label="Kapasite (ton)"
          defaultValue={trNum(vehicle?.capacity_ton)}
          hint="Kamyonlar için; tonaj tahmini"
          state={state}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          idPrefix={p}
          name="contractor_name"
          label="Taşeron / kiralayan firma"
          defaultValue={vehicle?.contractor_name}
          hint="Kiralık ve taşeron araçlar için; hakediş bu ada göre gruplanır"
          state={state}
        />
        <NumberField
          idPrefix={p}
          name="hourly_rate"
          label="Saatlik ücret (TL)"
          defaultValue={trNum(vehicle?.hourly_rate)}
          hint="Saatle kiralanan iş makineleri için, KDV hariç"
          state={state}
        />
      </div>
      <NumberField
        idPrefix={p}
        name="daily_rate"
        label="Günlük kira (TL)"
        defaultValue={trNum(vehicle?.daily_rate)}
        hint="Günlük kiralanan araçlar için, KDV hariç. Aracın sefer ya da makine kaydı olan her gün sayılır; girilirse sefer ve saat ücreti ayrıca ödenmez."
        state={state}
      />
      <NumberField
        idPrefix={p}
        name="fuel_norm_lph"
        label="Yakıt normu (litre/saat)"
        defaultValue={trNum(vehicle?.fuel_norm_lph)}
        hint="İş makineleri için; bunun %20 üzerinde yakan kayıtlar kırmızı görünür"
        state={state}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={active}
          className="size-5 accent-[var(--brand)]"
        />
        Aktif (sefer girişinde listelenir)
      </label>
      <SubmitButton>{vehicle ? "Kaydet" : "Araç ekle"}</SubmitButton>
    </form>
  );
}
