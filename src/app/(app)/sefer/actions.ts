"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/actions";
import { canManage, getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { minTapGapMinutes } from "@/lib/field-checks";
import { isoDateTR } from "@/lib/format";

// Çevrimdışı kuyruktan gelen eski tarihli seferler: ileri tarih olamaz; saha personeli en fazla
// 7 gün, firma sahibi/yönetici en fazla 62 gün geriye gönderebilir
function isAllowedTapDate(
  date: string,
  maxDaysBack = 7,
  today = isoDateTR(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const oldest = new Date(`${today}T00:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - maxDaysBack);
  return date <= today && date >= oldest.toISOString().slice(0, 10);
}

export type TapResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

const PATHS = ["/sefer", "/panel", "/kayitlar", "/gunluk"];

// Tek dokunuş = bir sefer kaydı (saat damgalı). requestId, zayıf internette
// tekrar gönderilen dokunuşun ikinci kez sayılmasını engeller.
export async function tapTrip(input: {
  siteId: string;
  vehicleId: string;
  routeId: string | null;
  requestId: string;
  entryDate?: string; // internet yokken girilip sonra gönderilen seferin günü
  tonnage?: number | null; // kantar tonu (isteğe bağlı)
  at?: number; // dokunuş anı (ms); internetsiz girilip sonra gönderilen seferde gerçek an
}): Promise<TapResult> {
  const { siteId, vehicleId, routeId, requestId } = input;
  if (
    ![siteId, vehicleId, requestId].every(isUuid) ||
    (routeId !== null && !isUuid(routeId))
  ) {
    return { ok: false, error: "Geçersiz istek" };
  }
  const entryDate = input.entryDate ?? isoDateTR();
  const tonnage = input.tonnage ?? null;
  if (
    tonnage !== null &&
    !(Number.isFinite(tonnage) && tonnage > 0 && tonnage <= 200)
  ) {
    return { ok: false, error: "Ton 0 ile 200 arasında olmalı" };
  }
  const { supabase, user, tenant } = await getContext();
  if (!isAllowedTapDate(entryDate, canManage(tenant.role) ? 62 : 7)) {
    return {
      ok: false,
      error: canManage(tenant.role)
        ? "Sefer tarihi geçersiz (en fazla 62 gün önceye girilebilir)"
        : "Sefer 7 günden eski: Kayıt gir ekranından elle girin ya da yöneticinize iletin",
    };
  }
  const { error } = await supabase.from("trip_entries").insert({
    tenant_id: tenant.id,
    site_id: siteId,
    vehicle_id: vehicleId,
    route_id: routeId,
    entry_date: entryDate,
    trip_count: 1,
    tonnage: tonnage === null ? null : Math.round(tonnage * 1000) / 1000,
    client_request_id: requestId,
  });
  if (error && error.code !== "23505")
    return { ok: false, error: dbErrorMessage(error) };
  PATHS.forEach((p) => revalidatePath(p));
  // Sefer kaydedilir ama başka biri aynı aracı az önce saydıysa uyarılır (iki puantör)
  const at =
    typeof input.at === "number" && Number.isFinite(input.at)
      ? input.at
      : Date.now();
  const gap = await tapGapMinutes(supabase, routeId);
  const { data: near } = await supabase
    .from("trip_entries")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("site_id", siteId)
    .eq("vehicle_id", vehicleId)
    .neq("created_by", user.id)
    .gte("created_at", new Date(at - gap * 60_000).toISOString())
    .lte("created_at", new Date(at + gap * 60_000).toISOString())
    .limit(1);
  if (near?.length)
    return {
      ok: true,
      warning: `${formatGap(gap)} içinde başka bir kullanıcı da bu aracı saydı; çift sayım olabilir. Aynı seferse geri alın.`,
    };
  return { ok: true };
}

async function tapGapMinutes(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  routeId: string | null,
) {
  if (!routeId) return minTapGapMinutes(null);
  const { data } = await supabase
    .from("routes")
    .select("cycle_minutes")
    .eq("id", routeId)
    .maybeSingle();
  return minTapGapMinutes(data?.cycle_minutes);
}

const formatGap = (minutes: number) => `${Math.round(minutes)} dakika`;

// Son dokunuşu geri al: bugün bu araca girilen en son kayıt silinir.
// Saha personeli yalnızca kendi kaydını geri alabilir (RLS de ayrıca engeller).
export async function undoTrip(input: {
  siteId: string;
  vehicleId: string;
  entryDate?: string; // sayacın iş günü (gece vardiyasında takvim gününden farklı olabilir)
}): Promise<TapResult> {
  if (!isUuid(input.siteId) || !isUuid(input.vehicleId))
    return { ok: false, error: "Geçersiz istek" };
  const { supabase, user, tenant } = await getContext();
  const entryDate = input.entryDate ?? isoDateTR();
  if (!isAllowedTapDate(entryDate, 1))
    return { ok: false, error: "Geçersiz istek" };

  let q = supabase
    .from("trip_entries")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("site_id", input.siteId)
    .eq("vehicle_id", input.vehicleId)
    .eq("entry_date", entryDate)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!canManage(tenant.role)) q = q.eq("created_by", user.id);
  const { data: last } = await q.maybeSingle();
  if (!last) return { ok: false, error: "Geri alınacak kendi kaydınız yok" };

  const { data, error } = await supabase
    .from("trip_entries")
    .delete()
    .eq("id", last.id)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "Bu kaydı silme yetkiniz yok" };
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: true };
}
