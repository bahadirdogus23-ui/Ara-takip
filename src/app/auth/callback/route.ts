import { NextResponse, type NextRequest } from "next/server";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

// E-posta doğrulama bağlantısı buraya döner: ?code=... ile oturum açılır.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  // Şifre yenileme bağlantısı ?sonra=/sifre-yenile ile gelir
  const next = safePath(request.nextUrl.searchParams.get("sonra"));
  const to = request.nextUrl.clone();
  to.search = "";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  }
  to.pathname = "/giris";
  to.search = "?hata=1";
  return NextResponse.redirect(to);
}
