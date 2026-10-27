"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { signUp } from "../actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Field
        name="email"
        label="E-posta"
        type="email"
        autoComplete="email"
        state={state}
        required
      />
      <Field
        name="password"
        label="Şifre"
        type="password"
        autoComplete="new-password"
        hint="En az 8 karakter"
        state={state}
        required
      />
      <SubmitButton pendingText="Hesap oluşturuluyor…">Kayıt ol</SubmitButton>
    </form>
  );
}
