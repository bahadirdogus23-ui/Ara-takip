import { Clock, CreditCard } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { TenantSwitcher } from "@/app/(app)/tenant-switcher";
import { getTenantContext, isPlanActive } from "@/lib/context";
import { formatDateTR, isoDateTR } from "@/lib/format";
import { paymentInfo } from "@/lib/plan";
import { PaymentNoticeForm } from "./payment-form";

export const metadata = { title: "Abonelik" };

// Aboneliği aktif olmayan firma buraya düşer. Aktifse uygulamaya geçilir.
export default async function PaymentPage() {
  const { supabase, tenant, tenants } = await getTenantContext();
  if (isPlanActive(tenant, isoDateTR())) redirect("/panel");

  const { data: row } = await supabase
    .from("tenants")
    .select("payment_notified_at, payment_note")
    .eq("id", tenant.id)
    .single();
  const info = paymentInfo();
  const expired = tenant.planStatus === "active"; // aktif ama ödeme süresi geçmiş
  const owner = tenant.role === "owner";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="text-center">
        <p className="text-3xl font-extrabold tracking-tight">
          Hafri<span className="text-brand">yol</span>
        </p>
        {tenants.length > 1 ? (
          <div className="mt-2 flex justify-center">
            <TenantSwitcher tenants={tenants} activeId={tenant.id} />
          </div>
        ) : (
          <p className="mt-1 font-semibold">{tenant.name}</p>
        )}
      </div>

      <section className="card space-y-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <CreditCard className="size-5 text-brand" aria-hidden />
          {expired
            ? "Abonelik süresi doldu"
            : tenant.planStatus === "suspended"
              ? "Abonelik askıda"
              : "Aboneliği başlatın"}
        </h1>
        {!owner ? (
          <p className="text-sm text-muted">
            Firmanızın Hafriyol aboneliği aktif değil. Firma sahibi ödemeyi
            tamamlayınca uygulamayı kullanmaya devam edebilirsiniz.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Ödeme onaylanınca firmanız açılır ve <strong>firma sahibi</strong>{" "}
              olarak başlarsınız: şantiyelerinizi kurar, mühendis ve saha
              personeline davet kodu verirsiniz.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-bg p-3 text-sm">
              {info.price && (
                <>
                  <dt className="text-muted">Ücret</dt>
                  <dd className="font-semibold">{info.price}</dd>
                </>
              )}
              {info.iban && (
                <>
                  <dt className="text-muted">IBAN</dt>
                  <dd className="font-mono font-semibold break-all">
                    {info.iban}
                  </dd>
                </>
              )}
              {info.receiver && (
                <>
                  <dt className="text-muted">Alıcı</dt>
                  <dd>{info.receiver}</dd>
                </>
              )}
              <dt className="text-muted">Açıklama</dt>
              <dd>{tenant.name}</dd>
              {info.contact && (
                <>
                  <dt className="text-muted">İletişim</dt>
                  <dd>{info.contact}</dd>
                </>
              )}
            </dl>
            {!info.iban && (
              <p className="text-sm text-muted">
                Ödeme bilgileri için Hafriyol ile iletişime geçin.
              </p>
            )}
            {row?.payment_notified_at && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                {formatDateTR(row.payment_notified_at)} tarihli bildiriminiz
                inceleniyor{row.payment_note ? `: “${row.payment_note}”` : ""}.
              </p>
            )}
            <PaymentNoticeForm />
          </>
        )}
      </section>

      <Link href="/basla" className="link text-center text-sm">
        Davet kodum var / başka firma
      </Link>
      <SignOutButton className="btn-secondary w-full gap-2" label="Çıkış yap" />
    </main>
  );
}
