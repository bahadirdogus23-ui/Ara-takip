import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// E-posta doğrulama bağlantısı buraya döner: ?code=... ile oturum açılır.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = request.nextUrl.clone();
  to.search = "";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      to.pathname = "/panel";
      return NextResponse.redirect(to);
    }
  }
  to.pathname = "/giris";
  to.search = "?hata=1";
  return NextResponse.redirect(to);
}
