"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/validation";

type FieldProps = {
  name: string;
  label: string;
  state: FormState;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
};

// Etiket + giriş kutusu + alanın altında Türkçe hata mesajı
export function Field({ name, label, state, defaultValue, type = "text", required, autoComplete, hint }: FieldProps) {
  const error = state?.fieldErrors?.[name];
  const value = state?.values?.[name] ?? defaultValue ?? "";
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={type === "password" ? undefined : value}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className="input"
      />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// Gönderim sürerken kilitlenir: çift tıklama ile iki kayıt oluşmaz.
export function SubmitButton({ children, pendingText = "Kaydediliyor…" }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className="btn-primary w-full sm:w-auto">
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {state.error}
    </div>
  );
}
