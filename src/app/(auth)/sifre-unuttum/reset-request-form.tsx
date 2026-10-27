"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form";
import { requestPasswordReset } from "../actions";

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <FormSuccess state={state} />
      <Field
        name="email"
        label="E-posta"
        type="email"
        autoComplete="email"
        state={state}
        required
      />
      <SubmitButton pendingText="Gönderiliyor…">Bağlantı gönder</SubmitButton>
    </form>
  );
}
