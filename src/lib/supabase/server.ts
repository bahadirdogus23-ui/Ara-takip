import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/env";

// Sunucu bileşenleri ve server action'lar için. Kullanıcının kendi oturumuyla
// bağlanır; bu yüzden veritabanındaki RLS kuralları her sorguda geçerlidir.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Sunucu bileşeninden çağrıldığında çerez yazılamaz; oturumu middleware yeniler.
        }
      },
    },
  });
}
