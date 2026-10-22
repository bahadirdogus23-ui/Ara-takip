// Tarayıcıya gidebilen ortak değişkenler. Gizli anahtar (service_role) burada YOK
// ve uygulamada hiç kullanılmıyor.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanımlı değil. .env.example dosyasına bakın.",
    );
  }
  return { url, key };
}
