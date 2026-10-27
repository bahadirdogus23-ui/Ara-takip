import { redirect } from "next/navigation";
import { DeleteButton } from "@/components/form";
import { getContext } from "@/lib/context";
import { formatDateTR } from "@/lib/format";
import { removeMember } from "./actions";
import { AddMemberForm, RoleSelect } from "./member-forms";

export const metadata = { title: "Kullanıcılar" };

export default async function MembersPage() {
  const { supabase, user, tenant } = await getContext();
  if (tenant.role !== "owner") redirect("/panel");

  const { data: members, error } = await supabase.rpc("tenant_members", {
    p_tenant: tenant.id,
  });
  if (error) throw new Error("Kullanıcılar alınamadı");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Kullanıcılar</h1>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {members.map((m) => (
          <li
            key={m.user_id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {m.email}
                {m.user_id === user.id && (
                  <span className="ml-2 text-xs text-muted">(siz)</span>
                )}
              </p>
              <p className="text-xs text-muted">
                {formatDateTR(m.created_at)} tarihinde eklendi
              </p>
            </div>
            <div className="flex items-center gap-3">
              <RoleSelect userId={m.user_id} role={m.role} />
              {m.user_id !== user.id && (
                <DeleteButton
                  action={removeMember}
                  id={m.user_id}
                  label="Çıkar"
                  confirmText={`${m.email} firmadan çıkarılsın mı?`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="card">
        <h2 className="mb-3 font-semibold">Kullanıcı ekle</h2>
        <AddMemberForm />
      </div>
    </div>
  );
}
