"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { joinWithCode } from "./actions";

export function JoinForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinWithCode, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormError state={state} />
      <Field
        name="code"
        label="Davet kodu"
        defaultValue={code}
        autoComplete="off"
        placeholder="ör. K7MQ-2XPA"
        hint="Kodu firma sahibinden ya da şantiye mühendisinden alın"
        state={state}
        required
      />
      <SubmitButton pendingText="Katılınıyor…">Firmaya katıl</SubmitButton>
    </form>
  );
}
