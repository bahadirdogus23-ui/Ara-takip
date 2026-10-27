"use client";

import { Lock, LockOpen } from "lucide-react";
import { useActionState } from "react";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/form";
import { formatDateTR } from "@/lib/format";
import { setPeriodLock } from "./actions";

export function LockForm({
  siteId,
  lockedUntil,
  owner,
  today,
}: {
  siteId: string;
  lockedUntil: string | null;
  owner: boolean;
  today: string;
}) {
  const [state, action] = useActionState(setPeriodLock, null);
  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        {lockedUntil ? (
          <Lock className="size-5 text-amber-600" aria-hidden />
        ) : (
          <LockOpen className="size-5 text-muted" aria-hidden />
        )}
        Dönem kilidi
      </h2>
      <p className="text-sm text-muted">
        {lockedUntil
          ? `${formatDateTR(lockedUntil)} tarihine kadar kilitli: bu tarihe kadar kayıt eklenemez, düzeltilemez, silinemez; ücret değişiklikleri de bu dönemi etkilemez.`
          : "Hakedişi kapanan ayı kilitleyin: o tarihe kadar kayıtlar ve ücretler değiştirilemez."}
      </p>
      <FormError state={state} />
      <FormSuccess state={state} />
      <form
        action={action}
        className="flex flex-wrap items-end gap-3"
        noValidate
      >
        <input type="hidden" name="site_id" value={siteId} />
        <input type="hidden" name="islem" value="kilitle" />
        <div className="min-w-44 flex-1">
          <Field
            idPrefix="lock"
            name="locked_until"
            type="date"
            label="Şu tarihe kadar (dahil) kilitle"
            defaultValue={lockedUntil ?? undefined}
            max={today}
            state={state}
          />
        </div>
        <SubmitButton>Kilitle</SubmitButton>
      </form>
      {lockedUntil && owner && (
        <form action={action}>
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="islem" value="ac" />
          <button type="submit" className="btn-secondary">
            Kilidi kaldır
          </button>
        </form>
      )}
      {lockedUntil && !owner && (
        <p className="text-xs text-muted">
          Kilidi yalnızca firma sahibi kaldırabilir.
        </p>
      )}
    </section>
  );
}
