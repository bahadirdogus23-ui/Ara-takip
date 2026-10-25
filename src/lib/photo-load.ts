import type { SupabaseClient } from "@supabase/supabase-js";
import type { GridPhoto } from "@/components/photo-grid";
import type { Database } from "@/lib/database.types";
import { PHOTO_BUCKET } from "@/lib/photos";

// Fotoğraflar özel kovada: görüntülemek için 1 saatlik imzalı adres üretilir
// (kullanıcının oturumuyla; başka firmanın dosyası için adres üretilemez).
export async function loadPhotos(
  supabase: SupabaseClient<Database>,
  filter: { siteId: string; from: string; to: string },
  canDelete: (createdBy: string) => boolean,
  limit = 120,
): Promise<GridPhoto[]> {
  const { data: rows } = await supabase
    .from("photos")
    .select("id, kind, caption, taken_on, storage_path, created_by")
    .eq("site_id", filter.siteId)
    .gte("taken_on", filter.from)
    .lte("taken_on", filter.to)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!rows?.length) return [];
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    url: urlByPath.get(r.storage_path) ?? null,
    kind: r.kind,
    caption: r.caption,
    takenOn: r.taken_on,
    canDelete: canDelete(r.created_by),
  }));
}
