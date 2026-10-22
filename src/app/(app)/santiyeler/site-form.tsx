"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import type { Tables } from "@/lib/database.types";
import { SITE_STATUSES } from "@/lib/validation";
import { saveSite } from "./actions";

export function SiteForm({ site }: { site?: Tables<"sites"> }) {
  const [state, action] = useActionState(saveSite, null);
  const status = state?.values?.status ?? site?.status ?? "active";

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      {site && <input type="hidden" name="id" value={site.id} />}

      <Field name="name" label="Şantiye adı" defaultValue={site?.name} state={state} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="code" label="Kod / ihale no" defaultValue={site?.code} state={state} />
        <Field name="employer" label="İşveren" defaultValue={site?.employer} state={state} hint="Ör. belediye, KGM, özel firma" />
      </div>
      <Field name="location" label="Konum" defaultValue={site?.location} state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="start_date" label="Başlangıç" type="date" defaultValue={site?.start_date} state={state} />
        <Field name="end_date" label="Bitiş" type="date" defaultValue={site?.end_date} state={state} />
      </div>

      <div className="space-y-1">
        <label htmlFor="status" className="block text-sm font-medium">
          Durum
        </label>
        <select id="status" name="status" defaultValue={status} className="input">
          {Object.entries(SITE_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.status && <p className="text-sm text-red-600">{state.fieldErrors.status}</p>}
      </div>

      <SubmitButton>{site ? "Değişiklikleri kaydet" : "Şantiyeyi ekle"}</SubmitButton>
    </form>
  );
}
