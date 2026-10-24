"use client";

import { useActionState } from "react";
import { Field, FormError, FormSuccess, SelectField, SubmitButton } from "@/components/form";
import type { MemberRole } from "@/lib/database.types";
import { addMember, changeRole } from "./actions";

const ROLE_OPTIONS = [
  { value: "field", label: "Saha personeli: imalat ve sefer girer, gider göremez" },
  { value: "manager", label: "Yönetici: tüm kayıtlar, giderler, raporlar" },
  { value: "owner", label: "Firma sahibi: yukarıdakiler + kullanıcı yönetimi" },
];

export function AddMemberForm() {
  const [state, action] = useActionState(addMember, null);
  return (
    <form key={state?.ok} action={action} className="space-y-3" noValidate>
      <FormSuccess state={state} />
      <FormError state={state} />
      <Field idPrefix="mb" name="email" label="E-posta" type="email" autoComplete="off" hint="Kişi önce Hafriyol'a kayıt olmuş olmalı" state={state} required />
      <SelectField idPrefix="mb" name="role" label="Rol" options={ROLE_OPTIONS} defaultValue="field" state={state} required />
      <SubmitButton pendingText="Ekleniyor…">Kullanıcı ekle</SubmitButton>
    </form>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: MemberRole }) {
  const [state, action] = useActionState(changeRole, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="user_id" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Rol
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input min-h-9 py-1 text-sm"
      >
        <option value="field">Saha personeli</option>
        <option value="manager">Yönetici</option>
        <option value="owner">Firma sahibi</option>
      </select>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
