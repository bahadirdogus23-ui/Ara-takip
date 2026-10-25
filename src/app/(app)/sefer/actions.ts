"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { isoDateTR } from "@/lib/format";

export type TapResult = { ok: true } | { ok: false; error: string };

const PATHS = ["/sefer", "/panel", "/kayitlar", "/gunluk"];

// Tek dokunuş = bir sefer kaydı (saat damgalı). requestId, zayıf internette
// tekrar gönderilen dokunuşun ikinci kez sayılmasını engeller.
export async function tapTrip(input: { siteId: string; vehicleId: string; routeId: string | null; requestId: string }): Promise<TapResult> {
  const { siteId, vehicleId, routeId, requestId } = input;
  if (![siteId, vehicleId, requestId].every(isUuid) || (routeId !== null && !isUuid(routeId))) {
    return { ok: false, error: "Geçersiz istek" };
  }
  const { supabase, tenant } = await getContext();
  const { error } = await supabase.from("trip_entries").insert({
    tenant_id: tenant.id,
    site_id: siteId,
    vehicle_id: vehicleId,
    route_id: routeId,
    entry_date: isoDateTR(),
    trip_count: 1,
    client_request_id: requestId,
  });
  if (error && error.code !== "23505") return { ok: false, error: dbErrorMessage(error) };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: true };
}

// Son dokunuşu geri al: bugün bu araca girilen en son kayıt silinir.
// Saha personeli yalnızca kendi kaydını geri alabilir (RLS de ayrıca engeller).
export async function undoTrip(input: { siteId: string; vehicleId: string }): Promise<TapResult> {
  if (!isUuid(input.siteId) || !isUuid(input.vehicleId)) return { ok: false, error: "Geçersiz istek" };
  const { supabase, user, tenant } = await getContext();

  let q = supabase
    .from("trip_entries")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("site_id", input.siteId)
    .eq("vehicle_id", input.vehicleId)
    .eq("entry_date", isoDateTR())
    .order("created_at", { ascending: false })
    .limit(1);
  if (!canManage(tenant.role)) q = q.eq("created_by", user.id);
  const { data: last } = await q.maybeSingle();
  if (!last) return { ok: false, error: "Geri alınacak kendi kaydınız yok" };

  const { data, error } = await supabase.from("trip_entries").delete().eq("id", last.id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Bu kaydı silme yetkiniz yok" };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: true };
}
