import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/env";

// Oturum açmadan girilebilen sayfalar
const PUBLIC_PATHS = ["/giris", "/kayit", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() token'ı Supabase'e doğrulatır; getSession() bunu yapmaz.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/giris";
    to.search = path === "/" ? "" : `?sonra=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  if (user && (path === "/giris" || path === "/kayit")) {
    const to = request.nextUrl.clone();
    to.pathname = "/panel";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return response;
}
