import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantForm } from "./tenant-form";

export const metadata = { title: "Firma oluştur" };

export default async function CreateTenantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");
  const { count } = await supabase
    .from("memberships")
    .select("tenant_id", { count: "exact", head: true });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="card">
        <h1 className="text-xl font-bold">
          {count ? "Yeni firma ekle" : "Firmanızı oluşturun"}
        </h1>
        <p className="mb-5 mt-1 text-sm text-muted">
          Şantiyeler, araçlar ve kayıtlar bu firmaya bağlı tutulur. Firmanızın
          sahibi siz olursunuz; çalışma arkadaşlarınızı sonra davet
          edebilirsiniz.
        </p>
        <TenantForm />
      </div>
    </main>
  );
}
