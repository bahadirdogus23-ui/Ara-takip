import { redirect } from "next/navigation";
import { canManage, getContext } from "@/lib/context";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Hızlı kurulum" };

export default async function SetupPage() {
  const { tenant } = await getContext();
  if (!canManage(tenant.role)) redirect("/panel");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hızlı kurulum</h1>
        <p className="text-sm text-muted">Bir dakikada şantiyenizi, işlerinizi ve araçlarınızı ekleyin; hemen sefer saymaya başlayın.</p>
      </div>
      <div className="card">
        <SetupForm />
      </div>
    </div>
  );
}
