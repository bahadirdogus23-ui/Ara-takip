"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { DAY_START_HOURS, SITE_STATUSES } from "@/lib/validation";
import { saveSite } from "./actions";

export function SiteForm({ site }: { site?: Tables<"sites"> }) {
  const [state, action] = useActionState(saveSite, null);
  const status = state?.values?.status ?? site?.status ?? "active";
  const dayStart =
    state?.values?.day_start_hour ?? String(site?.day_start_hour ?? 0);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      {site && <input type="hidden" name="id" value={site.id} />}

      <Field
        name="name"
        label="Şantiye adı"
        defaultValue={site?.name}
        state={state}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="code"
          label="Kod / ihale no"
          defaultValue={site?.code}
          state={state}
        />
        <Field
          name="employer"
          label="İşveren"
          defaultValue={site?.employer}
          state={state}
          hint="Ör. belediye, KGM, özel firma"
        />
      </div>
      <Field
        name="location"
        label="Konum"
        defaultValue={site?.location}
        state={state}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="start_date"
          label="Başlangıç"
          type="date"
          defaultValue={site?.start_date}
          state={state}
        />
        <Field
          name="end_date"
          label="Bitiş"
          type="date"
          defaultValue={site?.end_date}
          state={state}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="status" className="block text-sm font-medium">
          Durum
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="input"
        >
          {Object.entries(SITE_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.status && (
          <p className="text-sm text-red-600">{state.fieldErrors.status}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="day_start_hour" className="block text-sm font-medium">
          İş günü başlangıcı
        </label>
        <select
          id="day_start_hour"
          name="day_start_hour"
          defaultValue={dayStart}
          aria-describedby="day_start_hour-hint"
          className="input"
        >
          {DAY_START_HOURS.map((h) => (
            <option key={h} value={h}>
              {h === 0
                ? "00:00 (gece yarısı)"
                : `${String(h).padStart(2, "0")}:00`}
            </option>
          ))}
        </select>
        <p id="day_start_hour-hint" className="text-xs text-muted">
          Gece vardiyası çalışıyorsanız ör. 06:00 seçin: 06:00&apos;dan önceki
          seferler bir önceki iş gününe yazılır, vardiya iki güne bölünmez.
        </p>
        {state?.fieldErrors?.day_start_hour && (
          <p className="text-sm text-red-600">
            {state.fieldErrors.day_start_hour}
          </p>
        )}
      </div>

      <SubmitButton>
        {site ? "Değişiklikleri kaydet" : "Şantiyeyi ekle"}
      </SubmitButton>
    </form>
  );
}
