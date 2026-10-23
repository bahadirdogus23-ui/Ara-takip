import { DeleteButton } from "@/components/form";
import { canManage, getContext } from "@/lib/context";
import { formatTrNumber } from "@/lib/number";
import { VEHICLE_OWNERSHIP } from "@/lib/validation";
import { deleteVehicle } from "./actions";
import { VehicleForm } from "./vehicle-form";

export const metadata = { title: "Araçlar" };

export default async function VehiclesPage() {
  const { supabase, tenant } = await getContext();
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("active", { ascending: false })
    .order("plate");
  if (error) throw new Error("Araçlar alınamadı");
  const manager = canManage(tenant.role);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Araçlar ve iş makineleri</h1>

      {vehicles.length === 0 ? (
        <p className="card text-sm text-muted">Henüz araç yok. Sefer girebilmek için en az bir araç ekleyin.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {vehicles.map((v) => (
            <li key={v.id} className={`px-4 py-3 ${v.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums">
                    {v.plate}
                    {!v.active && <span className="ml-2 text-xs font-normal text-muted">(pasif)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {v.vehicle_type} · {VEHICLE_OWNERSHIP[v.ownership as keyof typeof VEHICLE_OWNERSHIP] ?? v.ownership}
                    {v.capacity_ton !== null && ` · ${formatTrNumber(v.capacity_ton, 2)} ton`}
                  </p>
                </div>
                {manager && (
                  <DeleteButton
                    action={deleteVehicle}
                    id={v.id}
                    confirmText={`${v.plate} silinsin mi? Seferi olan araç silinemez; bunun yerine pasif yapın.`}
                  />
                )}
              </div>
              {manager && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-brand-strong">Düzenle</summary>
                  <div className="mt-3">
                    <VehicleForm vehicle={v} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {manager && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Yeni araç</h2>
          <VehicleForm />
        </div>
      )}
    </div>
  );
}
