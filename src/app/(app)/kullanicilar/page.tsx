import { redirect } from "next/navigation";
import { DeleteButton } from "@/components/form";
import { canManage, getContext, ROLE_LABELS } from "@/lib/context";
import { formatDateTR } from "@/lib/format";
import { removeMember, revokeInvite } from "./actions";
import { prettyCode } from "@/lib/invite";
import { InviteForm, RoleSelect } from "./member-forms";

export const metadata = { title: "Kullanıcılar" };

export default async function MembersPage() {
  const { supabase, user, tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/panel");
  const owner = tenant.role === "owner";

  const [{ data: members, error }, { data: codes }] = await Promise.all([
    supabase.rpc("tenant_members", { p_tenant: tenant.id }),
    supabase
      .from("invite_codes")
      .select(
        "code, role, label, expires_at, max_uses, uses, revoked, created_at",
      )
      .eq("tenant_id", tenant.id)
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error("Kullanıcılar alınamadı");
  const now = new Date().toISOString();
  const liveCodes = (codes ?? []).filter(
    (c) =>
      (!c.expires_at || c.expires_at > now) &&
      (c.max_uses === null || c.uses < c.max_uses),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Kullanıcılar</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">Davet kodu ver</h2>
        <p className="text-sm text-muted">
          Çalışan uygulamayı açıp kayıt olur, “Davet kodum var” deyip kodu
          girer; seçtiğiniz yetkiyle hemen başlar.
          {!owner && " Yönetici olarak saha personeli davet edebilirsiniz."}
        </p>
        <InviteForm
          owner={owner}
          siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        />
      </section>

      {liveCodes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Geçerli kodlar</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {liveCodes.map((c) => (
              <li
                key={c.code}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p>
                    <span className="font-mono font-bold">
                      {prettyCode(c.code)}
                    </span>{" "}
                    · {ROLE_LABELS[c.role]}
                    {c.label && (
                      <span className="text-muted"> · {c.label}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {c.max_uses === null
                      ? `${c.uses} kişi katıldı`
                      : `${c.uses}/${c.max_uses} kullanıldı`}
                    {c.expires_at
                      ? ` · ${formatDateTR(c.expires_at)} tarihine kadar`
                      : " · süresiz"}
                  </p>
                </div>
                <DeleteButton
                  action={revokeInvite}
                  id={c.code}
                  label="İptal et"
                  confirmText={`${prettyCode(c.code)} kodu iptal edilsin mi?`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">Firmadaki kişiler ({members.length})</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {members.map((m) => {
            const self = m.user_id === user.id;
            const canRemove = !self && (owner || m.role === "field");
            return (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.email}
                    {self && (
                      <span className="ml-2 text-xs text-muted">(siz)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTR(m.created_at)} tarihinde katıldı
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {owner ? (
                    <RoleSelect userId={m.user_id} role={m.role} />
                  ) : (
                    <span className="text-sm text-muted">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                  {canRemove && (
                    <DeleteButton
                      action={removeMember}
                      id={m.user_id}
                      label="Çıkar"
                      confirmText={`${m.email} firmadan çıkarılsın mı?`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
