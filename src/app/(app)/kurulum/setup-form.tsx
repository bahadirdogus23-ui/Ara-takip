"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { WORK_ITEM_TEMPLATES } from "@/lib/setup";
import { UNITS } from "@/lib/validation";
import { quickSetup } from "./actions";

export function SetupForm() {
  const [state, action] = useActionState(quickSetup, null);
  const checked = (key: string, def?: boolean) => (state?.values ? state.values[`item_${key}`] === "on" : !!def);
  const vehiclesError = state?.fieldErrors?.vehicles;

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormError state={state} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <Step n={1} /> Şantiye
        </h2>
        <Field name="site_name" label="Şantiye adı" hint="Ör. Çevre Yolu 1. Kısım" state={state} required />
        <Field name="employer" label="İşveren" hint="İsteğe bağlı: belediye, KGM, özel firma…" state={state} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <Step n={2} /> Yapacağınız işler
        </h2>
        <p className="text-sm text-muted">Hazır listeden seçin; birim fiyatları sonra girebilirsiniz.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WORK_ITEM_TEMPLATES.map((t) => (
            <label
              key={t.key}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3 has-[:checked]:border-brand has-[:checked]:bg-brand/10"
            >
              <input type="checkbox" name={`item_${t.key}`} defaultChecked={checked(t.key, t.checked)} className="peer sr-only" />
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-line peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 dark:peer-checked:text-black">
                <Check className="size-4" aria-hidden strokeWidth={3} />
              </span>
              <span className="flex-1 text-sm font-medium">{t.name}</span>
              <span className="text-xs text-muted">{UNITS[t.unit]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Step n={3} /> Kamyon ve iş makineleri
        </h2>
        <label htmlFor="vehicles" className="block text-sm text-muted">
          Her satıra bir araç: plaka, tür, kapasite (ton). Kiralıksa sona &quot;kiralık&quot; ve günlük kirayı yazın.
        </label>
        <textarea
          id="vehicles"
          name="vehicles"
          rows={5}
          defaultValue={state?.values?.vehicles ?? ""}
          placeholder={"06 ABC 123, Kamyon, 25\n06 KR 501, Kamyon, 30, kiralık 9000\nEKS-01, Ekskavatör, , kiralık 12000"}
          aria-invalid={!!vehiclesError}
          className="input min-h-32 py-2 font-mono text-sm"
        />
        {vehiclesError && <p className="text-sm text-red-600">{vehiclesError}</p>}
      </section>

      <SubmitButton pendingText="Hazırlanıyor…">Kurulumu bitir</SubmitButton>
    </form>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white dark:text-black">{n}</span>
  );
}
