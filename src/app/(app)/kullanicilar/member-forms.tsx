"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { FormError, SelectField, SubmitButton, Field } from "@/components/form";
import type { MemberRole } from "@/lib/database.types";
import { prettyCode } from "@/lib/invite";
import { createInvite, changeRole } from "./actions";

export const ROLE_TEXT: Record<MemberRole, string> = {
  field: "Saha personeli: sefer, imalat, makine girer; para tutarı görmez",
  manager:
    "Yönetici / mühendis: tüm kayıtlar, giderler, raporlar; saha personeli davet eder",
  owner: "Firma sahibi: her şey + kullanıcı ve rol yönetimi",
};

export function InviteForm({
  owner,
  siteUrl,
}: {
  owner: boolean;
  siteUrl: string;
}) {
  const [state, action] = useActionState(createInvite, null);
  const [copied, setCopied] = useState(false);
  const code = state?.ok && state.message ? state.message : null;
  const roles: MemberRole[] = owner ? ["field", "manager", "owner"] : ["field"];
  const link = code ? `${siteUrl}/basla?kod=${code}` : "";
  const text = code
    ? `Hafriyol'a katılmak için uygulamayı açıp kayıt olun, sonra davet kodunu girin: ${prettyCode(code)}\n${link}`
    : "";

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3" noValidate>
        <FormError state={state} />
        <SelectField
          idPrefix="iv"
          name="role"
          label="Yetki"
          options={roles.map((r) => ({ value: r, label: ROLE_TEXT[r] }))}
          defaultValue="field"
          state={state}
          required
        />
        <Field
          idPrefix="iv"
          name="label"
          label="Kime / not"
          placeholder="ör. Kamyon şoförleri, Ahmet Usta"
          state={state}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            idPrefix="iv"
            name="days"
            label="Geçerlilik"
            options={[
              { value: "1", label: "1 gün" },
              { value: "7", label: "7 gün" },
              { value: "30", label: "30 gün" },
              { value: "365", label: "1 yıl" },
              { value: "", label: "Süresiz" },
            ]}
            defaultValue="7"
            state={state}
          />
          <SelectField
            idPrefix="iv"
            name="max_uses"
            label="Kaç kişi kullanabilir"
            options={[
              { value: "1", label: "Tek kişi" },
              { value: "5", label: "5 kişi" },
              { value: "20", label: "20 kişi" },
              { value: "100", label: "100 kişi" },
              { value: "", label: "Sınırsız" },
            ]}
            defaultValue="1"
            state={state}
          />
        </div>
        <SubmitButton pendingText="Oluşturuluyor…">
          Davet kodu oluştur
        </SubmitButton>
      </form>

      {code && (
        <div
          role="status"
          className="space-y-3 rounded-xl border border-brand bg-brand/5 p-4 text-center"
        >
          <p className="text-sm text-muted">Davet kodu</p>
          <p className="font-mono text-3xl font-extrabold tracking-widest">
            {prettyCode(code)}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn-secondary gap-1.5"
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                setCopied(true);
              }}
            >
              <Copy className="size-4" aria-hidden />{" "}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
            <a
              className="btn-primary gap-1.5"
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp ile
              gönder
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: MemberRole;
}) {
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
        <option value="manager">Yönetici / mühendis</option>
        <option value="owner">Firma sahibi</option>
      </select>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.message && !state.error && (
        <p className="text-xs text-green-700 dark:text-green-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
