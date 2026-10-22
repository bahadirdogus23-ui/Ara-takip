"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { createTenant } from "./actions";

export function TenantForm() {
  const [state, action] = useActionState(createTenant, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Field name="name" label="Firma adı" autoComplete="organization" state={state} required />
      <SubmitButton pendingText="Oluşturuluyor…">Firmayı oluştur</SubmitButton>
    </form>
  );
}
