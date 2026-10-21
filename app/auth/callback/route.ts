import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordLogin } from "@/lib/loginEvents";
import { getAppUrl } from "@/lib/url";

// Tujuan redirect OAuth (Google) & konfirmasi email.
// Daftarkan https://<domain-kamu>/auth/callback dan http://localhost:3000/auth/callback di Supabase Auth → URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const flow = searchParams.get("flow") ?? "signin"; // "signin" | "signup"
  // Default ke /portal (user pilih mode dulu)
  const next = searchParams.get("next") ?? "/portal";
  const safeNext = next.startsWith("/") ? next : `/${next}`;

  // Tentukan Base URL pengalihan yang akurat
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  const baseUrl = isLocalEnv
    ? origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : getAppUrl();

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;
      const createdAt = new Date(user.created_at).getTime();
      const now = Date.now();
      // User baru terbuat jika selisih waktu dibuatnya kurang dari 20 detik yang lalu
      const isNewlyCreated = Math.abs(now - createdAt) < 20000;

      // ── KASUS 1: Klik "Masuk dengan Google" di /login padahal akun BELUM terdaftar ──
      if (flow === "signin" && isNewlyCreated) {
        console.warn(`[AUTH] Percobaan login akun baru ditolak untuk user: ${user.email}. Membatalkan sesi dan membersihkan data akun temporer.`);

        // 1. Cabut sesi di browser
        await supabase.auth.signOut();

        // 2. Hapus akun dari auth.users via admin client agar email bersih untuk pendaftaran resmi
        try {
          await supabaseAdmin.auth.admin.deleteUser(user.id);
        } catch (delErr: any) {
          console.error("[AUTH] Gagal deleteUser:", delErr?.message);
        }

        // 3. Arahkan kembali ke /login dengan notifikasi informatif
        return NextResponse.redirect(`${baseUrl}/login?error=account_not_found`);
      }

      // ── KASUS 2: Pendaftaran resmi dari /register ATAU login user lama ──
      await recordLogin(supabase, user.id); // Fitur DM

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      // Jika pendaftaran baru via Google atau profil belum menyelesaikan onboarding
      if (flow === "signup" || (profile && profile.onboarding_completed === false)) {
        return NextResponse.redirect(`${baseUrl}/onboarding`);
      }

      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    } else if (error) {
      console.error("Auth callback exchangeCodeForSession failed:", error.message);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback`);
}
