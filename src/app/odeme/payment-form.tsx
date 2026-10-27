"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form";
import { notifyPayment } from "./actions";

export function PaymentNoticeForm() {
  const [state, action] = useActionState(notifyPayment, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormSuccess state={state} />
      <FormError state={state} />
      <Field
        name="note"
        label="Ödeme açıklaması"
        placeholder="ör. 27.10 tarihli EFT, gönderen Doğuş Hafriyat"
        hint="Havale/EFT açıklamasına firma adınızı yazmanız yeterli"
        state={state}
      />
      <SubmitButton pendingText="Gönderiliyor…">Ödemeyi yaptım</SubmitButton>
    </form>
  );
}
