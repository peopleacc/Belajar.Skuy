import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });

  // Supabase belum dikonfigurasi → biarkan lewat (halaman menampilkan notice setup)
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // PENTING: getUser() (bukan getSession) agar token divalidasi ke server Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Rute yang wajib login (Fitur BG menambah /portal & /simulation, Fitur EF menambah /profile)
  const PRIVATE = ["/dashboard", "/portal", "/simulation", "/profile"];
  if (!user && PRIVATE.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // `/pricing` SENGAJA tidak ikut aturan redirect di bawah. Halaman harga harus bisa
  // dibuka user yang SUDAH login (tombol "Upgrade Premium" di sidebar & "Lihat paket"
  // di portal menuju ke sana) — kalau ikut dilempar seperti "/", tombol itu jadi
  // lingkaran yang tak pernah sampai. Dia tetap masuk matcher supaya cookie sesi ikut
  // disegarkan, sehingga halamannya bisa mengenali paket akun user.
  //
  // Fitur BG — tujuannya /portal, bukan /dashboard: sekarang ada DUA dashboard
  // (course & simulasi), jadi user memilih dulu, tidak diasumsikan.
  if (user && (path === "/login" || path === "/register" || path === "/")) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  // Fitur DM — ping berkala "masih aktif" untuk kartu Aktif Belakangan Ini di
  // admin-dashboard. Beda dari `recordLogin` (dipanggil sekali di titik login):
  // ini menjaga `last_seen_at` tetap segar SELAMA user browsing, bukan cuma
  // saat pertama masuk. Di-throttle lewat cookie (10 menit) — kalau tidak,
  // setiap navigasi halaman jadi satu write ke Supabase.
  if (user) {
    const PING_COOKIE = "lsp";
    const THROTTLE_MS = 10 * 60 * 1000;
    const lastPing = request.cookies.get(PING_COOKIE)?.value;
    const now = Date.now();
    if (!lastPing || now - Number(lastPing) > THROTTLE_MS) {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id);
      response.cookies.set(PING_COOKIE, String(now), {
        maxAge: 3600,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/pricing",
    "/portal",
    "/simulation/:path*",
    "/dashboard/:path*",
    "/profile",
  ],
};
