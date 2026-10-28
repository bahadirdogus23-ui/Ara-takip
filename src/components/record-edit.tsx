"use client";

import { useActionState } from "react";
import {
  Field,
  FormError,
  FormSuccess,
  NumberField,
  SubmitButton,
} from "@/components/form";
import type { FormState } from "@/lib/validation";

export type EditField = {
  name: string;
  label: string;
  value: string | number | null;
  number?: boolean; // Türkçe sayı ("120,5")
};

const trNum = (v: string | number | null) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

// Listede bir kaydı yerinde düzeltme: "Düzelt" açılır, alanlar değişir, işlem geçmişine yazılır
export function RecordEdit({
  action,
  id,
  fields,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  fields: EditField[];
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-brand-strong">
        Düzelt
      </summary>
      <form action={formAction} className="mt-2 space-y-2" noValidate>
        <FormError state={state} />
        <FormSuccess state={state} />
        <input type="hidden" name="id" value={id} />
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) =>
            f.number ? (
              <NumberField
                key={f.name}
                idPrefix={`ed-${id}`}
                name={f.name}
                label={f.label}
                defaultValue={trNum(f.value)}
                state={state}
              />
            ) : (
              <Field
                key={f.name}
                idPrefix={`ed-${id}`}
                name={f.name}
                label={f.label}
                defaultValue={f.value}
                state={state}
              />
            ),
          )}
        </div>
        <SubmitButton>Kaydet</SubmitButton>
      </form>
    </details>
  );
}
