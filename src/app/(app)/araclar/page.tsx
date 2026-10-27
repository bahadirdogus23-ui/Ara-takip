import { DeleteButton } from "@/components/form";
import { canManage, getContext } from "@/lib/context";
import { formatTrNumber } from "@/lib/number";
import { loadPrices } from "@/lib/prices";
import { VEHICLE_KIND, VEHICLE_OWNERSHIP } from "@/lib/validation";
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
  const [{ data: sites }, { data: links }] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("site_vehicles")
      .select("site_id, vehicle_id")
      .eq("tenant_id", tenant.id),
  ]);
  const siteName = new Map(sites?.map((x) => [x.id, x.name]));
  const sitesOf = (vehicleId: string) =>
    (links ?? [])
      .filter((l) => l.vehicle_id === vehicleId)
      .map((l) => l.site_id);
  // Yeni araç, araç ataması kullanan şantiyelere varsayılan olarak atanır
  const assigning = new Set(links?.map((l) => l.site_id));
  const choices = (checked: (siteId: string) => boolean) =>
    (sites ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      checked: checked(x.id),
    }));
  const manager = canManage(tenant.role);
  // Kira ücretleri ayrı tabloda, yalnızca sahibi/yöneticiye açık
  const rates = manager
    ? (await loadPrices(supabase, tenant.id)).vehicle
    : new Map();
  const withRates = vehicles.map((v) => ({
    ...v,
    hourly_rate: rates.get(v.id)?.hourly_rate ?? null,
    daily_rate: rates.get(v.id)?.daily_rate ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Araçlar ve iş makineleri</h1>

      {withRates.length === 0 ? (
        <p className="card text-sm text-muted">
          Henüz araç yok. Sefer girebilmek için en az bir araç ekleyin.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {withRates.map((v) => (
            <li
              key={v.id}
              className={`px-4 py-3 ${v.active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums">
                    {v.plate}
                    {!v.active && (
                      <span className="ml-2 text-xs font-normal text-muted">
                        (pasif)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {v.vehicle_type} · {VEHICLE_KIND[v.kind]} ·{" "}
                    {VEHICLE_OWNERSHIP[
                      v.ownership as keyof typeof VEHICLE_OWNERSHIP
                    ] ?? v.ownership}
                    {v.capacity_ton !== null &&
                      ` · ${formatTrNumber(v.capacity_ton, 2)} ton`}
                    {v.fuel_norm_lph !== null &&
                      ` · norm ${formatTrNumber(v.fuel_norm_lph, 2)} L/saat`}
                    {v.contractor_name && ` · ${v.contractor_name}`}
                  </p>
                  {sitesOf(v.id).some((id) => siteName.has(id)) && (
                    <p className="text-xs text-muted">
                      Şantiye:{" "}
                      {sitesOf(v.id)
                        .flatMap((id) => siteName.get(id) ?? [])
                        .join(", ")}
                    </p>
                  )}
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
                  <summary className="cursor-pointer text-sm font-medium text-brand-strong">
                    Düzenle
                  </summary>
                  <div className="mt-3">
                    <VehicleForm
                      vehicle={v}
                      sites={choices((id) => sitesOf(v.id).includes(id))}
                    />
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
          <VehicleForm sites={choices((id) => assigning.has(id))} />
        </div>
      )}
    </div>
  );
}
