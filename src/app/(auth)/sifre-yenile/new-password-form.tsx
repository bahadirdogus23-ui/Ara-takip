"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { updatePassword } from "../actions";

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Field
        name="password"
        label="Yeni şifre"
        type="password"
        autoComplete="new-password"
        state={state}
        required
      />
      <Field
        name="password_again"
        label="Yeni şifre (tekrar)"
        type="password"
        autoComplete="new-password"
        state={state}
        required
      />
      <SubmitButton pendingText="Kaydediliyor…">Şifreyi kaydet</SubmitButton>
    </form>
  );
}
