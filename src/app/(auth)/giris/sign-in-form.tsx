"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { signIn } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      {next && <input type="hidden" name="sonra" value={next} />}
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
        autoComplete="current-password"
        state={state}
        required
      />
      <SubmitButton pendingText="Giriş yapılıyor…">Giriş yap</SubmitButton>
    </form>
  );
}
