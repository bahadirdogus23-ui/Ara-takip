"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/actions";
import { getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import { isValidPhotoPath, PHOTO_BUCKET, PHOTO_KINDS } from "@/lib/photos";
import type { FormState } from "@/lib/validation";

const PATHS = ["/fotograflar", "/panel"];

// Dosya tarayıcıdan doğrudan Storage'a yüklendikten sonra kaydı açar
export async function addPhoto(input: { siteId: string; path: string; kind: string; caption: string; takenOn: string }) {
  const { supabase, tenant } = await getContext();
  const caption = input.caption.trim().slice(0, 300) || null;
  if (!isUuid(input.siteId) || !isValidPhotoPath(input.path, tenant.id, input.siteId) || !(input.kind in PHOTO_KINDS)) {
    return { ok: false as const, error: "Geçersiz fotoğraf" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.takenOn)) return { ok: false as const, error: "Geçersiz tarih" };

  const { error } = await supabase.from("photos").insert({
    tenant_id: tenant.id,
    site_id: input.siteId,
    storage_path: input.path,
    kind: input.kind,
    caption,
    taken_on: input.takenOn,
  });
  if (error) {
    // Kayıt açılamadıysa yüklenen dosya ortada kalmasın
    await supabase.storage.from(PHOTO_BUCKET).remove([input.path]);
    return { ok: false as const, error: dbErrorMessage(error) };
  }
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: true as const };
}

export async function deletePhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Geçersiz kayıt" };
  const { supabase, tenant } = await getContext();
  const { data, error } = await supabase.from("photos").delete().eq("id", id).eq("tenant_id", tenant.id).select("storage_path");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Bu fotoğrafı silme yetkiniz yok" };
  await supabase.storage.from(PHOTO_BUCKET).remove(data.map((d) => d.storage_path));
  PATHS.forEach((p) => revalidatePath(p));
  return { ok: id, message: "Silindi" };
}
