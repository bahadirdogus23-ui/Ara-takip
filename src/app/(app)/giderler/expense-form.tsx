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
import { EXPENSE_CATEGORIES, VAT_RATES } from "@/lib/validation";
import { saveExpense } from "./actions";

const categoryOptions = Object.entries(EXPENSE_CATEGORIES).map(
  ([value, label]) => ({ value, label }),
);
const vatOptions = VAT_RATES.map((v) => ({ value: v, label: `%${v}` }));

export function ExpenseForm({
  sites,
  items,
  defaultSiteId,
  today,
  requestId,
}: {
  sites: Option[];
  items: Option[];
  defaultSiteId: string;
  today: string;
  requestId: string;
}) {
  const [state, action] = useActionState(saveExpense, null);
  return (
    <form key={state?.ok} action={action} className="space-y-3" noValidate>
      <FormSuccess state={state} />
      <FormError state={state} />
      <input
        type="hidden"
        name="client_request_id"
        value={state?.ok ?? requestId}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          idPrefix="ex"
          name="site_id"
          label="Şantiye"
          options={sites}
          defaultValue={defaultSiteId}
          placeholder="Seçin…"
          state={state}
          required
        />
        <Field
          idPrefix="ex"
          name="expense_date"
          label="Tarih"
          type="date"
          defaultValue={today}
          state={state}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SelectField
          idPrefix="ex"
          name="category"
          label="Gider türü"
          options={categoryOptions}
          placeholder="Seçin…"
          state={state}
          required
        />
        <NumberField
          idPrefix="ex"
          name="amount"
          label="Tutar (TL, KDV hariç)"
          placeholder="ör. 12.500,00"
          state={state}
          required
        />
        <SelectField
          idPrefix="ex"
          name="vat_rate"
          label="KDV"
          options={vatOptions}
          defaultValue="20"
          state={state}
          required
        />
      </div>
      <SelectField
        idPrefix="ex"
        name="work_item_id"
        label="İş kalemi"
        options={items}
        placeholder="— Genel gider (iş kalemine bağlı değil) —"
        hint="Seçilirse bu gider o kalemin birim maliyetine eklenir"
        state={state}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix="ex"
          name="supplier"
          label="Tedarikçi / kime"
          state={state}
        />
        <Field
          idPrefix="ex"
          name="description"
          label="Açıklama"
          state={state}
        />
      </div>
      <SubmitButton>Gideri kaydet</SubmitButton>
    </form>
  );
}
