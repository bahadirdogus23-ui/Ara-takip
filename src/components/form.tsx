"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/validation";

type BaseProps = {
  name: string;
  label: string;
  state: FormState;
  defaultValue?: string | number | null;
  required?: boolean;
  hint?: string;
  // Aynı sayfada birden fazla form varsa kimlik çakışmasın
  idPrefix?: string;
};

type FieldProps = BaseProps & {
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
};

function useFieldState({ name, state, defaultValue, idPrefix }: BaseProps) {
  const id = idPrefix ? `${idPrefix}-${name}` : name;
  const error = state?.fieldErrors?.[name];
  const value =
    state?.values?.[name] ??
    (defaultValue === null || defaultValue === undefined
      ? ""
      : String(defaultValue));
  return { id, error, value };
}

function Label({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      {required && <span className="text-red-600"> *</span>}
    </label>
  );
}

function Help({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-sm text-red-600">
        {error}
      </p>
    );
  }
  return hint ? <p className="text-xs text-muted">{hint}</p> : null;
}

// Etiket + giriş kutusu + alanın altında Türkçe hata mesajı
export function Field(props: FieldProps) {
  const {
    name,
    label,
    type = "text",
    required,
    autoComplete,
    hint,
    inputMode,
    placeholder,
  } = props;
  const { id, error, value } = useFieldState(props);
  return (
    <div className="space-y-1">
      <Label id={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={type === "password" ? undefined : value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="input"
      />
      <Help id={id} error={error} hint={hint} />
    </div>
  );
}

// Türkçe sayı girişi: telefonda sayısal klavye açılır, "120,5" yazılabilir
export function NumberField(props: Omit<FieldProps, "type" | "inputMode">) {
  return (
    <Field {...props} type="text" inputMode="decimal" autoComplete="off" />
  );
}

export type Option = { value: string; label: string; group?: string };

export function SelectField(
  props: BaseProps & { options: Option[]; placeholder?: string },
) {
  const { name, label, required, hint, options, placeholder } = props;
  const { id, error, value } = useFieldState(props);

  // Seçenekler grup adına göre (ör. şantiye) gruplanır
  const groups = new Map<string, Option[]>();
  for (const o of options)
    groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);
  const render = (list: Option[]) =>
    list.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));

  return (
    <div className="space-y-1">
      <Label id={id} label={label} required={required} />
      <select
        // Kayıttan sonra form sıfırlanınca tarayıcı ilk seçeneğe dönmesin: değer değişince yeniden kurulur
        key={value}
        id={id}
        name={name}
        defaultValue={value}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="input"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {[...groups].map(([group, list]) =>
          group ? (
            <optgroup key={group} label={group}>
              {render(list)}
            </optgroup>
          ) : (
            render(list)
          ),
        )}
      </select>
      <Help id={id} error={error} hint={hint} />
    </div>
  );
}

// Gönderim sürerken kilitlenir: çift tıklama ile iki kayıt oluşmaz.
export function SubmitButton({
  children,
  pendingText = "Kaydediliyor…",
  className = "btn-primary w-full sm:w-auto",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {state.error}
    </div>
  );
}

export function FormSuccess({ state }: { state: FormState }) {
  if (!state?.ok || !state.message) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800"
    >
      {state.message}
    </div>
  );
}

// Silmeden önce onay ister; silinemezse (ör. kayıtlarda kullanılıyorsa) nedenini gösterir.
export function DeleteButton({
  action,
  id,
  confirmText = "Bu kayıt silinsin mi?",
  label = "Sil",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  confirmText?: string;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        pendingText="Siliniyor…"
        className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
      >
        {label}
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="mt-1 max-w-56 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
