import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { dbErrorMessage } from "@/lib/errors";
import type { FormState } from "@/lib/validation";

type DeletableTable =
  | "work_items"
  | "routes"
  | "vehicles"
  | "production_entries"
  | "trip_entries"
  | "expenses"
  | "machine_logs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID.test(v);

// Bir kaydı düzeltir. Yetki ve tarih kuralları (dönem kilidi, saha personeline 7 gün)
// veritabanında; izin yoksa hiçbir satır değişmez ve kullanıcıya bildirilir.
export async function updateRow(
  table: DeletableTable,
  id: unknown,
  row: Record<string, unknown>,
  paths: string[],
): Promise<FormState> {
  if (!isUuid(id)) return { error: "Geçersiz kayıt" };
  const { supabase, tenant } = await getContext();
  const { data, error } = await supabase
    .from(table)
    .update(row as never)
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length)
    return { error: "Bu kaydı düzeltme yetkiniz yok veya kayıt bulunamadı" };
  paths.forEach((p) => revalidatePath(p));
  return { ok: `${id}-${Date.now()}`, message: "Düzeltildi" };
}

// Bir kaydı siler. Yetki RLS ile veritabanında kontrol edilir: izin yoksa
// hiçbir satır silinmez ve kullanıcıya bildirilir.
export async function deleteRow(
  table: DeletableTable,
  formData: FormData,
  paths: string[],
): Promise<FormState> {
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Geçersiz kayıt" };

  const { supabase, tenant } = await getContext();
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length)
    return { error: "Bu kaydı silme yetkiniz yok veya kayıt bulunamadı" };

  paths.forEach((p) =>
    p.includes("[") ? revalidatePath(p, "page") : revalidatePath(p),
  );
  return { ok: id, message: "Silindi" };
}
