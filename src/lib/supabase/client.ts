import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// Tarayıcıdan doğrudan Supabase'e (yalnızca fotoğraf yükleme için). Oturum çerezini kullanır;
// erişim kuralları (RLS) burada da geçerli.
export function createClient() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
