import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

/**
 * Helper redirect aman (OWASP ZAP Remediation - Task 4D-MH):
 * Menyematkan header keamanan esensial pada respons redirect agar tidak telanjang
 * saat dipindai scanner keamanan atau diakses browser.
 */
function secureRedirect(url: URL | string) {
  const res = NextResponse.redirect(url);
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  return res;
}

export async function middleware(request: NextRequest, event?: NextFetchEvent) {
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
  let user = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (err) {
    console.warn(
      "[middleware] Gagal menghubungi Supabase Auth (periksa koneksi internet atau status project Supabase):",
      err instanceof Error ? err.message : err
    );
  }

  const path = request.nextUrl.pathname;

  // Tangani kasus di mana Supabase OAuth me-redirect ke "/" atau halaman lain dengan ?code=...
  // (misalnya jika Supabase fallback ke Site URL default).
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode && !path.startsWith("/auth/callback")) {
    const callbackUrl = new URL("/auth/callback", request.url);
    request.nextUrl.searchParams.forEach((val, key) => {
      callbackUrl.searchParams.set(key, val);
    });
    return secureRedirect(callbackUrl);
  }

  // Rute yang wajib login (Fitur BG menambah /portal & /simulation, Fitur EF menambah /profile, Fitur Onboarding menambah /onboarding)
  const PRIVATE = ["/dashboard", "/portal", "/simulation", "/profile", "/onboarding"];
  if (!user && PRIVATE.some((p) => path.startsWith(p))) {
    return secureRedirect(new URL("/login", request.url));
  }
  // `/pricing` SENGAJA tidak ikut aturan redirect di bawah. Halaman harga harus bisa
  // dibuka user yang SUDAH login (tombol "Upgrade Premium" di sidebar & "Lihat paket"
  // di portal menuju ke sana) — kalau ikut dilempar seperti "/", tombol itu jadi
  // lingkaran yang tak pernah sampai. Dia tetap masuk matcher supaya cookie sesi ikut
  // disegarkan, sehingga halamannya bisa mengenali paket akun user.
  //
  // User yang sudah login dilarang membuka /login atau /register (diarahkan ke /portal).
  // Halaman landing ("/") dan harga ("/pricing") bebas diakses karena sudah session-aware.
  if (user && (path === "/login" || path === "/register")) {
    return secureRedirect(new URL("/portal", request.url));
  }

  // Task 14A-GH: Non-blocking telemetry decoupling
  // Ping berkala "masih aktif" untuk kartu Aktif Belakangan Ini di admin-dashboard.
  // Di-throttle lewat cookie (10 menit).
  // PENTING: Update database dijalankan secara asynchronous/non-blocking agar tidak menahan
  // server response dan navigasi pengguna (menghilangkan waterfall 80-150ms per klik).
  if (user) {
    const PING_COOKIE = "lsp";
    const THROTTLE_MS = 10 * 60 * 1000;
    const lastPing = request.cookies.get(PING_COOKIE)?.value;
    const now = Date.now();
    if (!lastPing || now - Number(lastPing) > THROTTLE_MS) {
      response.cookies.set(PING_COOKIE, String(now), {
        maxAge: 3600,
        httpOnly: true,
        sameSite: "lax",
      });

      const telemetryPromise = Promise.resolve(
        supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id)
      ).catch(() => {
        /* Abaikan kegagalan telemetry background agar navigasi tetap instan */
      });

      if (event && typeof event.waitUntil === "function") {
        event.waitUntil(telemetryPromise);
      }
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
    "/onboarding",
  ],
};
